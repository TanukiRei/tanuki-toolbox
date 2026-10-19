using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// One-shot WinExe: no PowerShell initialization, compilation or WMI on the
// close path. It survives the exact DSH instance it was created to replace.
class RestartWorker {
    const uint Query = 0x101000, Terminate = 0x101001, Pending = 258;
    static string directory, receipt, stage = "WORKER_INITIALIZATION_FAILED";
    static bool accepted, closing, chinese = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "zh";
    static readonly List<IntPtr> handles = new List<IntPtr>();
    static readonly List<FileStream> locks = new List<FileStream>();
    static readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 65536 };
    class Entry { public int Id, Parent; public string Name; }
    class Identity { public int Id; public long Born; public string Path; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct ProcessEntry {
        public uint Size, Usage, Id; public IntPtr Heap;
        public uint Module, Threads, Parent; public int Priority; public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string Name;
    }
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint id);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool Process32First(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int id);
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr handle, uint flags, StringBuilder name, ref int size);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetProcessTimes(IntPtr handle, out long created, out long exited, out long kernel, out long user);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr handle, uint code);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    delegate bool WindowCallback(IntPtr window, IntPtr param);
    [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr param);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint id);
    static void Require(bool condition, string code) { if (!condition) throw new Exception(code); }
    static bool Equal(string a, string b) { return String.Equals(a, b, StringComparison.OrdinalIgnoreCase); }
    static string ReadString(Dictionary<string, object> value, string key) {
        object result; Require(value.TryGetValue(key, out result) && result is string && ((string)result).Length > 0, "INVALID_REQUEST");
        return (string)result;
    }
    static Dictionary<string, object> ReadJson(string file) {
        Require(new FileInfo(file).Length <= 65536, "INVALID_REQUEST");
        return json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file, Encoding.UTF8));
    }
    static Dictionary<int, Entry> Snapshot() {
        IntPtr snapshot = CreateToolhelp32Snapshot(2, 0);
        Require(snapshot != new IntPtr(-1), "PROCESS_SNAPSHOT_FAILED");
        try {
            var result = new Dictionary<int, Entry>();
            var entry = new ProcessEntry { Size = (uint)Marshal.SizeOf(typeof(ProcessEntry)) };
            Require(Process32First(snapshot, ref entry), "PROCESS_SNAPSHOT_FAILED");
            do { int id = (int)entry.Id; result[id] = new Entry { Id = id, Parent = (int)entry.Parent, Name = entry.Name }; } while (Process32Next(snapshot, ref entry));
            Require(Marshal.GetLastWin32Error() == 18, "PROCESS_SNAPSHOT_FAILED");
            return result;
        } finally { CloseHandle(snapshot); }
    }
    static Identity IdentityOf(int id, IntPtr handle) {
        var name = new StringBuilder(32768); int size = name.Capacity;
        long born = 0, exited, kernel, user;
        Require(QueryFullProcessImageName(handle, 0, name, ref size) && GetProcessTimes(handle, out born, out exited, out kernel, out user) && WaitForSingleObject(handle, 0) == Pending, "INSTANCE_CHANGED");
        return new Identity { Id = id, Born = born, Path = name.ToString() };
    }
    static Identity Identify(int id) {
        IntPtr handle = OpenProcess(Query, false, id); Require(handle != IntPtr.Zero, "PROCESS_QUERY_DENIED");
        try { return IdentityOf(id, handle); } finally { CloseHandle(handle); }
    }
    static string Hash(string file) {
        using (var stream = File.OpenRead(file)) using (var hash = SHA256.Create())
            return BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
    }
    static void Publish(string status, string code) {
        if (receipt == null) return;
        string temporary = receipt + "." + Guid.NewGuid().ToString("N") + ".tmp";
        using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
            byte[] bytes = new UTF8Encoding(false).GetBytes(json.Serialize(new { status = status, code = code, protocol = 2, at = DateTime.UtcNow.ToString("o") }));
            file.Write(bytes, 0, bytes.Length); file.Flush(true);
        }
        if (File.Exists(receipt)) File.Replace(temporary, receipt, null); else File.Move(temporary, receipt);
    }
    static bool HasWindow(int processId) {
        bool found = false;
        EnumWindows(delegate(IntPtr window, IntPtr parameter) { uint id; GetWindowThreadProcessId(window, out id); if (id == processId) { found = true; return false; } return true; }, IntPtr.Zero);
        return found;
    }
    [STAThread] static int Main(string[] args) {
        bool owned = false; Mutex mutex = null;
        try {
            Require(args.Length == 1 && System.IO.Path.IsPathRooted(args[0]), "INVALID_REQUEST");
            string requestFile = System.IO.Path.GetFullPath(args[0]);
            directory = System.IO.Path.GetDirectoryName(requestFile);
            Guid requestId; Require(Guid.TryParseExact(System.IO.Path.GetFileName(directory), "D", out requestId), "INVALID_REQUEST");
            string state = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TanukiToolbox");
            Require(Equal(requestFile, System.IO.Path.Combine(state, "restart-transactions", requestId.ToString("D"), "request.json")), "INVALID_REQUEST");
            receipt = System.IO.Path.Combine(directory, "receipt.json");
            mutex = new Mutex(false, "Local\\TanukiRestartWorker-" + WindowsIdentity.GetCurrent().User.Value);
            try { owned = mutex.WaitOne(0); } catch (AbandonedMutexException) { owned = true; }
            Require(owned, "RESTART_IN_PROGRESS");
            var request = ReadJson(requestFile);
            Require(Equal(ReadString(request, "requestId"), requestId.ToString("D")), "INVALID_REQUEST");
            int hostId = Convert.ToInt32(request["hostPid"], CultureInfo.InvariantCulture);
            string hostPath = System.IO.Path.GetFullPath(ReadString(request, "hostPath"));
            string profilePath = System.IO.Path.GetFullPath(ReadString(request, "profilePath"));
            string launcherHash = ReadString(request, "launcherHash");
            Require(System.Text.RegularExpressions.Regex.IsMatch(launcherHash, "^[a-f0-9]{64}$"), "INVALID_REQUEST");
            stage = "REOPEN_LOCK_FAILED";
            string settingsFile = System.IO.Path.Combine(state, "settings.json");
            locks.Add(File.Open(settingsFile, FileMode.Open, FileAccess.Read, FileShare.Read));
            var settings = ReadJson(settingsFile);
            object complete; Require(settings.TryGetValue("installComplete", out complete) && Object.Equals(complete, true), "REOPEN_NOT_READY");
            object locale; if (settings.TryGetValue("locale", out locale)) chinese = Object.Equals(locale, "zh");
            string install = ReadString(settings, "installDirectory"), profile = ReadString(settings, "profileDirectory"), home = ReadString(settings, "dshHome");
            Require(System.IO.Path.IsPathRooted(install) && System.IO.Path.IsPathRooted(profile) && System.IO.Path.IsPathRooted(home) && Directory.Exists(home), "REOPEN_SETTINGS_INVALID");
            string app = System.IO.Path.GetFullPath(System.IO.Path.Combine(install, "DeepSeek Harness.exe"));
            Require(Equal(app, hostPath) && Equal(System.IO.Path.GetFullPath(profile), profilePath), "PROFILE_MISMATCH");
            string launcher = System.IO.Path.Combine(state, "ProtectedLauncher.exe"), script = System.IO.Path.Combine(profile, "node_modules", "dsh-local-plugin-center", "launcher", "launch.cjs");
            foreach (string file in new[] { app, launcher, script }) { Require(File.Exists(file), "REOPEN_NOT_READY"); locks.Add(File.Open(file, FileMode.Open, FileAccess.Read, FileShare.Read)); }
            Require(Hash(launcher) == launcherHash, "REOPEN_LAUNCHER_MISMATCH");
            stage = "PROCESS_IDENTITY_FAILED";
            var all = Snapshot(); Entry self = null, host = null;
            int ownId = Process.GetCurrentProcess().Id;
            // Direct parentage plus native birth times bind this transaction to
            // its requesting host, without trusting a PID supplied over HTTP.
            Require(all.TryGetValue(ownId, out self) && self.Parent == hostId && all.TryGetValue(hostId, out host), "HOST_IDENTITY_MISMATCH");
            var ownIdentity = Identify(ownId); var h = Identify(hostId);
            Require(Equal(h.Path, app) && h.Born <= ownIdentity.Born, "HOST_IDENTITY_MISMATCH");
            var root = h; Entry rootEntry = host; var seen = new HashSet<int>();
            while (true) {
                Require(seen.Add(root.Id), "INSTANCE_NOT_IDENTIFIED"); Entry parent;
                if (!all.TryGetValue(rootEntry.Parent, out parent) || !Equal(parent.Name, "DeepSeek Harness.exe")) break;
                var identity = Identify(parent.Id); if (!Equal(identity.Path, app)) break;
                Require(identity.Born <= root.Born, "INSTANCE_CHANGED"); root = identity; rootEntry = parent;
            }
            Require(root.Id != hostId && HasWindow(root.Id), "INSTANCE_NOT_IDENTIFIED");
            var targets = new List<Identity> { root }; var identities = new Dictionary<int, Identity> { { root.Id, root } };
            bool added;
            do {
                added = false;
                foreach (var entry in all.Values) {
                    Identity parent;
                    if (identities.ContainsKey(entry.Id) || !identities.TryGetValue(entry.Parent, out parent) || !Equal(entry.Name, "DeepSeek Harness.exe")) continue;
                    var identity = Identify(entry.Id); if (!Equal(identity.Path, app)) continue;
                    Require(identity.Born >= parent.Born, "INSTANCE_CHANGED"); identities[identity.Id] = identity; targets.Add(identity); added = true;
                }
            } while (added);
            Require(identities.ContainsKey(hostId) && identities[hostId].Born == h.Born, "INSTANCE_CHANGED");
            foreach (var entry in all.Values) Require(!Equal(entry.Name, "DeepSeek Harness.exe") || identities.ContainsKey(entry.Id), "OTHER_INSTANCE_RUNNING");
            stage = "PROCESS_HANDLE_FAILED";
            foreach (var identity in targets) {
                IntPtr handle = OpenProcess(Terminate, false, identity.Id); Require(handle != IntPtr.Zero, "INSTANCE_CHANGED"); handles.Add(handle);
                var pinned = IdentityOf(identity.Id, handle); Require(pinned.Born == identity.Born && Equal(pinned.Path, app), "INSTANCE_CHANGED");
            }
            Publish("accepted", "RESTART_ACCEPTED"); accepted = true;
            // The HTTP response can flush immediately. A lost acknowledgement
            // never strands a confirmed restart or adds the old 1.5 s delay.
            var acknowledgement = Stopwatch.StartNew();
            while (!File.Exists(System.IO.Path.Combine(directory, "continue")) && acknowledgement.ElapsedMilliseconds < 200) Thread.Sleep(5);
            closing = true; stage = "TERMINATE_FAILED";
            foreach (var handle in handles) if (WaitForSingleObject(handle, 0) == Pending) TerminateProcess(handle, 1);
            var exit = Stopwatch.StartNew();
            foreach (var handle in handles) { long remaining = Math.Max(0, 15000 - exit.ElapsedMilliseconds); Require(WaitForSingleObject(handle, (uint)remaining) == 0, "EXIT_TIMEOUT"); }
            stage = "REMAINING_INSTANCE_CHECK_FAILED";
            Require(!Snapshot().Values.Any(entry => Equal(entry.Name, "DeepSeek Harness.exe")), "REMAINING_INSTANCE_RUNNING");
            // Expensive plugin preflight belongs to ProtectedLauncher and runs
            // only now, after the old window and instance have disappeared.
            stage = "REOPEN_FAILED";
            var start = new ProcessStartInfo(launcher) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = state, WindowStyle = ProcessWindowStyle.Hidden };
            foreach (string name in new[] { "ELECTRON_RUN_AS_NODE", "NODE_OPTIONS", "NODE_PATH" }) start.EnvironmentVariables.Remove(name);
            using (var child = Process.Start(start)) Require(child != null, "REOPEN_FAILED");
            Publish("launched", "PROTECTED_LAUNCH_STARTED"); return 0;
        } catch (Exception error) {
            string code = System.Text.RegularExpressions.Regex.IsMatch(error.Message, "^[A-Z_]+$") ? error.Message : stage;
            try { if (directory != null) File.AppendAllText(System.IO.Path.Combine(directory, "worker.log"), DateTime.UtcNow.ToString("o") + " " + code + " " + error + Environment.NewLine); Publish(accepted ? "failed" : "unavailable", code); } catch { }
            if (closing) MessageBox.Show((chinese ? "DSH 重启未完成，请查看重启记录后重新打开。\n" : "DSH could not finish restarting. Review the restart record before reopening.\n") + code + "\n" + directory, chinese ? "黎猫重启" : "Tanuki Restart", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        } finally {
            foreach (var handle in handles) CloseHandle(handle);
            foreach (var stream in locks) stream.Dispose();
            if (owned) mutex.ReleaseMutex(); if (mutex != null) mutex.Dispose();
        }
    }
}
