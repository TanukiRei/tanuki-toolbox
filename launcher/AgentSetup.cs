using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.ComponentModel;
using System.Web.Script.Serialization;
// Wait for DSH, prepare with Electron, wait for that process too, then commit
// from native code. No Electron process may hold the archive at commit time.
class AgentSetup {
  [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process,int flags,StringBuilder name,ref int length);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool MoveFileEx(string from,string to,uint flags);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CopyFile(string from,string to,bool failIfExists);
  static JavaScriptSerializer json=new JavaScriptSerializer();
  static string Quote(string value){return "\""+value.Replace("\"","\\\"")+"\"";}
  static bool Same(string a,string b){return String.Equals(Path.GetFullPath(a),Path.GetFullPath(b),StringComparison.OrdinalIgnoreCase);}
  static string Value(Dictionary<string,object> value,string key){return (string)value[key];}
  static Dictionary<string,object> Read(string file){return json.Deserialize<Dictionary<string,object>>(File.ReadAllText(file));}
  static string Hash(string file){using(var stream=File.OpenRead(file))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();}
  static void Move(string temp,string target){if(!MoveFileEx(temp,target,1|8))throw new Win32Exception(Marshal.GetLastWin32Error());}
  static void Copy(string from,string to){if(!CopyFile(from,to,true))throw new Win32Exception(Marshal.GetLastWin32Error());}
  static void Save(string file,object data){string temp=file+"."+Guid.NewGuid().ToString("N")+".tmp";try{File.WriteAllText(temp,json.Serialize(data),new UTF8Encoding(false));Move(temp,file);}finally{if(File.Exists(temp))File.Delete(temp);}}
  static string Image(int pid){IntPtr handle=OpenProcess(0x1000,false,pid);if(handle==IntPtr.Zero)return null;try{var name=new StringBuilder(32768);int length=name.Capacity;return QueryFullProcessImageName(handle,0,name,ref length)?name.ToString():null;}finally{CloseHandle(handle);}}
  static void Commit(string planFile){
    string snapshot=Path.GetDirectoryName(planFile);var plan=Read(planFile);string executable=Value(plan,"executable"),profile=Value(plan,"profile");
    string directory=Path.Combine(profile,".tanuki-toolbox","agent-interface"),status=Path.Combine(directory,"desktop-setup.json"),commitFile=Path.Combine(snapshot,"commit.json");
    if(!File.Exists(commitFile)){Save(status,new{state="cancelled"});return;}
    var commit=Read(commitFile);string archive=Path.Combine(Path.GetDirectoryName(executable),"resources","app.asar"),bridge=Path.Combine(Path.GetDirectoryName(archive),"tanuki-agent-control.mjs");
    if(!Same(Value(commit,"archive"),archive)||!Same(Value(commit,"executable"),executable)||!Same(Value(commit,"profile"),profile))throw new Exception("COMMIT_PATH_MISMATCH");
    foreach(var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(executable))){using(process){string image=Image(process.Id);if(image==null||Same(image,executable))throw new Exception("DESKTOP_RUNNING");}}
    if(Hash(archive)!=Value(commit,"expectedSha256"))throw new Exception("ARCHIVE_CHANGED");
    string sourceBridge=Path.Combine(snapshot,"agent-desktop-main.mjs");if(Hash(sourceBridge)!=Value(commit,"bridgeSha256"))throw new Exception("BRIDGE_INTEGRITY_FAILED");
    var manifest=(Dictionary<string,object>)commit["manifest"];bool replace=(bool)commit["replaceArchive"];
    string staged=Path.Combine(snapshot,"app.asar.pending"),temporary=archive+".agent-"+Guid.NewGuid().ToString("N")+".tmp";
    if(replace&&(Hash(staged)!=Value(manifest,"patchedSha256")||Hash(Value(manifest,"backup"))!=Value(manifest,"originalSha256")))throw new Exception("ARCHIVE_INTEGRITY_FAILED");
    string bridgeTemp=bridge+"."+Guid.NewGuid().ToString("N")+".tmp";bool wroteBridge=false,committed=false;
    try{
      Copy(sourceBridge,bridgeTemp);Move(bridgeTemp,bridge);wroteBridge=true;
      // Persist recovery metadata first, so a crash just after the archive swap
      // does not leave an installed adapter without its verified original backup.
      Save(Path.Combine(directory,"desktop-adapter.json"),manifest);
      if(replace){Copy(staged,temporary);if(Hash(temporary)!=Value(manifest,"patchedSha256")||Hash(archive)!=Value(commit,"expectedSha256"))throw new Exception("ARCHIVE_CHANGED");Move(temporary,archive);}committed=true;
      Save(status,new{state="installed",nextLaunch=true});
      if(replace&&File.Exists(staged))File.Delete(staged);if(File.Exists(commitFile))File.Delete(commitFile);string checkedMain=Path.Combine(snapshot,"main-staged.mjs");if(File.Exists(checkedMain))File.Delete(checkedMain);
    }finally{if(File.Exists(temporary))File.Delete(temporary);if(File.Exists(bridgeTemp))File.Delete(bridgeTemp);if(!committed&&replace&&wroteBridge&&File.Exists(bridge)&&Hash(bridge)==Value(commit,"bridgeSha256"))File.Delete(bridge);}
  }
  [STAThread] static int Main(string[] args){
    IntPtr handle=IntPtr.Zero;string planFile=null;
    try{
      if(args.Length==2&&args[0]=="--commit"){planFile=Path.GetFullPath(args[1]);Commit(planFile);return 0;}
      if(args.Length!=3)return 2;int pid;if(!int.TryParse(args[0],out pid)||pid<=0)return 2;
      string executable=Path.GetFullPath(args[1]);planFile=Path.GetFullPath(args[2]);if(!File.Exists(executable)||!File.Exists(planFile))return 3;
      handle=OpenProcess(0x00100000|0x1000,false,pid);if(handle==IntPtr.Zero)return 4;
      var name=new StringBuilder(32768);int length=name.Capacity;if(!QueryFullProcessImageName(handle,0,name,ref length)||!Same(name.ToString(),executable))return 5;
      if(WaitForSingleObject(handle,0xffffffff)!=0)return 6;
      var info=new ProcessStartInfo(executable,"--expose-internals "+Quote(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"agent-desktop-install.cjs"))+" "+Quote(planFile));
      info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;info.EnvironmentVariables.Remove("NODE_OPTIONS");info.EnvironmentVariables.Remove("NODE_PATH");info.EnvironmentVariables["ELECTRON_RUN_AS_NODE"]="1";
      using(var child=Process.Start(info)){child.WaitForExit();if(child.ExitCode!=0)return child.ExitCode;}
      Commit(planFile);return 0;
    }catch(Exception error){try{Console.Error.WriteLine(error.ToString());}catch{}try{if(planFile!=null){var plan=Read(planFile);Save(Path.Combine(Value(plan,"profile"),".tanuki-toolbox","agent-interface","desktop-setup.json"),new{state="error",code=error is Win32Exception?"COMMIT_ACCESS_DENIED":System.Text.RegularExpressions.Regex.IsMatch(error.Message,"^[A-Z_]+$")?error.Message:"SETUP_UNAVAILABLE",detail=error.GetType().Name+": "+error.Message});}}catch{}return 10;}
    finally{if(handle!=IntPtr.Zero)CloseHandle(handle);}
  }
}
