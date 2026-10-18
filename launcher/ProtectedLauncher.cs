using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Threading;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("DeepSeek Harness · 黎猫保护启动")]
[assembly: AssemblyProduct("Tanuki Protected Launch")]
[assembly: AssemblyVersion("1.0.0.0")]
class ProtectedLauncher {
    static bool Chinese=System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName=="zh";
    static string Text(string zh,string en){return Chinese?zh:en;}
    static string Quote(string s){var b=new StringBuilder("\"");int slashes=0;foreach(char c in s){if(c=='\\'){slashes++;continue;}if(c=='\"')b.Append('\\',slashes*2+1);else b.Append('\\',slashes);slashes=0;b.Append(c);}b.Append('\\',slashes*2);return b.Append('"').ToString();}
    [STAThread] static int Main(string[] args){
        bool check=args.Length>0&&args[0]=="--check";
        string configPath=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"settings.json");
        if(check&&args.Length==2)configPath=Path.GetFullPath(args[1]);
        string root=Path.GetDirectoryName(configPath),errorFile=Path.Combine(Path.GetTempPath(),"tanuki-"+Guid.NewGuid().ToString("N")+".txt");
        bool locked=false;
        using(var mutex=new Mutex(false,"Local\\TanukiProtectedLaunch-"+System.Security.Principal.WindowsIdentity.GetCurrent().User.Value)) {
            try {
                try{locked=mutex.WaitOne(45000);}catch(AbandonedMutexException){locked=true;}
                if(!locked)throw new Exception(Text("另一个保护启动正在检查，请稍后重试。","Another protected launch is checking. Please try again shortly."));
                var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(configPath,Encoding.UTF8));
                if(data.ContainsKey("locale"))Chinese=Object.Equals(data["locale"],"zh");
                if(!check&&(!data.ContainsKey("installComplete")||!Object.Equals(data["installComplete"],true)))throw new Exception(Text("安装尚未完成，请重新运行黎猫一键安装包。","Installation is incomplete. Run the Tanuki installer again."));
                string install=(string)data["installDirectory"],home=(string)data["dshHome"],app=Path.Combine(install,"DeepSeek Harness.exe");
                string profile=data.ContainsKey("profileDirectory")?(string)data["profileDirectory"]:Path.Combine(home,"profiles","desktop");
                string script=Path.Combine(profile,"node_modules","dsh-local-plugin-center","launcher","launch.cjs");
                if(!File.Exists(app)||!File.Exists(script))throw new Exception(Text("DSH 或黎猫工具箱缺失，请重新运行黎猫一键安装包修复。","DSH or Tanuki Toolbox is missing. Repair it with the Tanuki installer."));
                string command="--expose-internals "+Quote(script)+" --error-file "+Quote(errorFile)+(check?" --dry-run":" -- "+String.Join(" ",args.Select(Quote)));
                var psi=new ProcessStartInfo(app,command){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                psi.EnvironmentVariables["ELECTRON_RUN_AS_NODE"]="1";psi.EnvironmentVariables["TANUKI_DSH_INSTALL"]=install;psi.EnvironmentVariables["DSH_HOME"]=home;psi.EnvironmentVariables["TANUKI_DSH_PROFILE"]=profile;
                var output=new StringBuilder();int exit;
                using(var p=new Process{StartInfo=psi}){
                    p.OutputDataReceived+=(s,e)=>{if(e.Data!=null)lock(output)output.AppendLine(e.Data);};
                    p.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)lock(output)output.AppendLine(e.Data);};
                    p.Start();p.BeginOutputReadLine();p.BeginErrorReadLine();
                    if(!p.WaitForExit(120000))throw new Exception(Text("保护检查超时，请查看保护启动日志后重试。","The protection check timed out. Review the protected-launch log and try again."));
                    p.WaitForExit();exit=p.ExitCode;
                }
                Directory.CreateDirectory(Path.Combine(root,"logs"));File.WriteAllText(Path.Combine(root,"logs","protected-launch.log"),DateTime.Now.ToString("s")+Environment.NewLine+output,Encoding.UTF8);
                if(exit!=0)throw new Exception(File.Exists(errorFile)?File.ReadAllText(errorFile,Encoding.Unicode):Text("保护检查未完成，请重新启用启动保护或使用一键安装包修复。","The protection check did not finish. Re-enable Startup Guard or repair with the installer."));
                return 0;
            }catch(Exception e){
                try{Directory.CreateDirectory(Path.Combine(root,"logs"));File.AppendAllText(Path.Combine(root,"logs","protected-launch.log"),DateTime.Now.ToString("s")+" "+e+Environment.NewLine,Encoding.UTF8);}catch{}
                if(!check)MessageBox.Show(e.Message,Text("黎猫保护启动","Tanuki Protected Launch"),MessageBoxButtons.OK,MessageBoxIcon.Warning);
                return 1;
            }finally{if(File.Exists(errorFile))File.Delete(errorFile);if(locked)mutex.ReleaseMutex();}
        }
    }
}
