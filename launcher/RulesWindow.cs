using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// Native ownership, geometry and transport only. The popup and this window share
// the generated RulesEditor.html DOM renderer, stylesheet and translations.
sealed class RulesWindow : Form {
    const string EditorUrl="https://tanuki-rules.invalid/RulesEditor.html";
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowProc callback,IntPtr data);
    delegate bool EnumWindowProc(IntPtr handle,IntPtr data);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle,out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr handle,StringBuilder text,int count);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr handle);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr handle,int message,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr handle);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr handle,out Rect rect);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr handle,out Rect rect);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr handle,IntPtr after,int x,int y,int width,int height,uint flags);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr handle,ref Point point);
    [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr handle,IntPtr region,bool redraw);
    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint first,uint last,IntPtr module,WinEventProc callback,uint pid,uint thread,uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
    delegate void WinEventProc(IntPtr hook,uint kind,IntPtr window,int objectId,int childId,uint thread,uint time);
    [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int left,int top,int right,int bottom,int width,int height);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32First(IntPtr snapshot,ref ProcessEntry entry);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32Next(IntPtr snapshot,ref ProcessEntry entry);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
    [StructLayout(LayoutKind.Sequential)] struct Rect {public int left,top,right,bottom;}
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ProcessEntry {public uint size,usage,pid;public UIntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string exe;}
    sealed class OwnerHandle:IWin32Window {readonly IntPtr handle;public OwnerHandle(IntPtr value){handle=value;}public IntPtr Handle{get{return handle;}}}
    static readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=1024*1024};
    static readonly object outputLock=new object();static StreamWriter output;static RulesWindow active;
    static readonly bool diagnostics=Environment.GetEnvironmentVariable("TANUKI_RULES_DIAGNOSTICS")=="1";
    readonly IntPtr owner;readonly EventWaitHandle hostExit;readonly RegisteredWaitHandle hostWatch;readonly WebView2 browser=new WebView2();
    readonly System.Windows.Forms.Timer dragTimer=new System.Windows.Forms.Timer{Interval=15};
    readonly System.Windows.Forms.Timer motionTimer=new System.Windows.Forms.Timer{Interval=15};
    readonly System.Windows.Forms.Timer ownerMoveTimer=new System.Windows.Forms.Timer{Interval=15};
    readonly Stopwatch motionClock=new Stopwatch();
    Dictionary<string,object> hello,presentation;
    string stage="starting",activeGesture="";
    bool stopping,initialized,uiReady,presented,dragQueued,tracking,clamping,closeRequested,followingOwner,followOwner,ownerMinimized;
    float viewScale=1,radius=15;double duration=180;
    bool animate=true;Point grab,ownerOffset;Rectangle lastOwner;
    ulong editorNavigation;
    IntPtr ownerHook;WinEventProc ownerCallback;GCHandle ownerCallbackRoot;
    static void Emit(object value){try{lock(outputLock){output.WriteLine(json.Serialize(value));output.Flush();}}catch{}}
    static string TextValue(Dictionary<string,object> value,string key,string fallback){object item;return value.TryGetValue(key,out item)&&item is string?(string)item:fallback;}
    static double Number(Dictionary<string,object> value,string key,double fallback){object item;try{return value.TryGetValue(key,out item)&&item!=null?Convert.ToDouble(item,CultureInfo.InvariantCulture):fallback;}catch{return fallback;}}
    static bool Flag(Dictionary<string,object> value,string key){object item;return value.TryGetValue(key,out item)&&item is bool&&(bool)item;}
    static HashSet<uint> Ancestors(int pid){var parents=new Dictionary<uint,uint>();IntPtr snapshot=CreateToolhelp32Snapshot(2,0);if(snapshot!=new IntPtr(-1)){try{var e=new ProcessEntry();e.size=(uint)Marshal.SizeOf(e);if(Process32First(snapshot,ref e))do{parents[e.pid]=e.parent;e.size=(uint)Marshal.SizeOf(e);}while(Process32Next(snapshot,ref e));}finally{CloseHandle(snapshot);}}var ids=new HashSet<uint>();uint current=(uint)pid;for(int i=0;i<12&&current!=0&&!ids.Contains(current);i++){ids.Add(current);uint parent;if(!parents.TryGetValue(current,out parent))break;current=parent;}return ids;}
    static IntPtr FindOwner(int pid){var ids=Ancestors(pid);IntPtr found=IntPtr.Zero,front=GetForegroundWindow();EnumWindows(delegate(IntPtr handle,IntPtr unused){uint id;GetWindowThreadProcessId(handle,out id);if(!ids.Contains(id)||!IsWindowVisible(handle))return true;var text=new StringBuilder(512);GetWindowText(handle,text,text.Capacity);string caption=text.ToString();if(caption.IndexOf("DeepSeek Harness",StringComparison.OrdinalIgnoreCase)>=0&&caption.IndexOf("Developer Tools",StringComparison.OrdinalIgnoreCase)<0){if(found==IntPtr.Zero||handle==front)found=handle;if(handle==front)return false;}return true;},IntPtr.Zero);return found;}
    int Px(double value){return (int)Math.Round(value*viewScale);}
    RulesWindow(int hostId,IntPtr ownerHandle){
        owner=ownerHandle;IntPtr hostHandle=OpenProcess(0x100000,false,(uint)hostId);
        if(hostHandle==IntPtr.Zero)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        hostExit=new EventWaitHandle(false,EventResetMode.ManualReset);hostExit.SafeWaitHandle=new Microsoft.Win32.SafeHandles.SafeWaitHandle(hostHandle,true);
        hostWatch=ThreadPool.RegisterWaitForSingleObject(hostExit,delegate{SafeClose();},null,Timeout.Infinite,true);
        try{viewScale=Math.Max(1,GetDpiForWindow(owner)/96f);}catch{}
        AutoScaleMode=AutoScaleMode.None;ShowInTaskbar=false;TopMost=false;FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.Manual;Text="规则 / Rules";
        Size=new Size(Px(390),Px(320));MinimumSize=new Size(Px(260),Px(180));Opacity=0;
        browser.Dock=DockStyle.Fill;Controls.Add(browser);
        Resize+=delegate{RoundCorners();};ResizeEnd+=delegate{ClampToScreen();UpdateAttachment();};
        LocationChanged+=delegate{if(presented&&!tracking&&!followingOwner)UpdateAttachment();};
        dragTimer.Tick+=delegate{TrackCursor();};motionTimer.Tick+=delegate{AnimateEntry();};ownerMoveTimer.Tick+=delegate{FollowOwner();};
        FormClosing+=delegate(object sender,FormClosingEventArgs e){if(!stopping&&presented&&initialized){e.Cancel=true;if(!closeRequested){closeRequested=true;Post(new{type="requestClose"});}}else stopping=true;};
        FormClosed+=delegate{dragTimer.Stop();motionTimer.Stop();ownerMoveTimer.Stop();dragTimer.Dispose();motionTimer.Dispose();ownerMoveTimer.Dispose();if(ownerHook!=IntPtr.Zero)UnhookWinEvent(ownerHook);if(ownerCallbackRoot.IsAllocated)ownerCallbackRoot.Free();hostWatch.Unregister(null);hostExit.Dispose();browser.Dispose();Application.ExitThread();};
    }
    void Post(object value){if(stopping||!initialized)return;try{browser.CoreWebView2.PostWebMessageAsJson(json.Serialize(value));}catch{Fail();}}
    void RoundCorners(){if(!IsHandleCreated||Width<2||Height<2)return;IntPtr region=CreateRoundRectRgn(0,0,Width+1,Height+1,Px(radius*2),Px(radius*2));if(region!=IntPtr.Zero&&SetWindowRgn(Handle,region,true)==0)DeleteObject(region);}
    void ClampToScreen(){if(clamping||WindowState==FormWindowState.Minimized)return;clamping=true;try{var area=Screen.FromRectangle(Bounds).WorkingArea;Size=new Size(Math.Min(Width,area.Width),Math.Min(Height,area.Height));Location=new Point(Math.Max(area.Left,Math.Min(Left,area.Right-Width)),Math.Max(area.Top,Math.Min(Top,area.Bottom-Height)));}finally{clamping=false;}}
    bool OwnerBounds(out Rectangle value){Rect rect;if(!IsIconic(owner)&&GetWindowRect(owner,out rect)&&rect.right>rect.left&&rect.bottom>rect.top){value=Rectangle.FromLTRB(rect.left,rect.top,rect.right,rect.bottom);return true;}value=Rectangle.Empty;return false;}
    void UpdateAttachment(){ownerMoveTimer.Stop();Rectangle bounds;if(OwnerBounds(out bounds)){lastOwner=bounds;followOwner=Bounds.IntersectsWith(bounds);ownerOffset=new Point(Left-bounds.Left,Top-bounds.Top);}}
    void FollowOwner(){
        // The hook only schedules this one-shot update. Moving an owned window
        // synchronously inside WinEvent delivery can reenter the owner's move
        // loop through their shared input queue. Read the latest bounds once,
        // discard intermediate positions and never reposition the owner in Z.
        ownerMoveTimer.Stop();if(stopping||!presented||tracking)return;
        Rectangle bounds;if(!OwnerBounds(out bounds)){ownerMinimized=true;return;}
        if(ownerMinimized){ownerMinimized=false;UpdateAttachment();return;}
        if(bounds==lastOwner)return;
        followingOwner=true;
        try{
            if(followOwner){
                int x=bounds.Left+ownerOffset.X,y=bounds.Top+ownerOffset.Y;
                if(x!=Left||y!=Top){
                    const uint flags=0x0001|0x0004|0x0010|0x0200|0x2000; // NOSIZE | NOZORDER | NOACTIVATE | NOOWNERZORDER | DEFERERASE
                    SetWindowPos(Handle,IntPtr.Zero,x,y,0,0,flags);
                }
            }
        }finally{
            followingOwner=false;lastOwner=bounds;followOwner=Bounds.IntersectsWith(bounds);
            ownerOffset=new Point(Left-bounds.Left,Top-bounds.Top);
        }
    }
    void InstallOwnerTracking(){
        if(ownerHook!=IntPtr.Zero)return;UpdateAttachment();
        ownerCallback=delegate(IntPtr hook,uint kind,IntPtr window,int objectId,int childId,uint thread,uint time){
            if(stopping||!presented||window!=owner||objectId!=0||childId!=0)return;
            if(!ownerMoveTimer.Enabled)ownerMoveTimer.Start();
        };
        ownerCallbackRoot=GCHandle.Alloc(ownerCallback);uint pid;GetWindowThreadProcessId(owner,out pid);
        ownerHook=SetWinEventHook(0x800B,0x800B,IntPtr.Zero,ownerCallback,pid,0,0);
        if(ownerHook==IntPtr.Zero)throw new InvalidOperationException("owner-location-hook");
    }
    void PrepareGeometry(Dictionary<string,object> value){
        object item;var m=value.TryGetValue("motion",out item)?item as Dictionary<string,object>:null;
        var origin=new Point(0,0);ClientToScreen(owner,ref origin);Rect rect;
        if(m!=null&&GetClientRect(owner,out rect)){
            double viewport=Number(m,"viewportWidth",0);if(viewport>=100)viewScale=(float)Math.Max(.5,Math.Min(4,(rect.right-rect.left)/viewport));
            MinimumSize=new Size(Px(260),Px(180));Size=new Size(Px(Number(m,"width",390)),Px(Number(m,"height",320)));
            radius=(float)Math.Max(0,Math.Min(40,Number(m,"radius",15)));duration=Math.Max(0,Math.Min(600,Number(m,"duration",180)));
            Location=new Point(origin.X+Px(Number(m,"x",0)),origin.Y+Px(Number(m,"y",0)));
            grab=new Point(Px(Number(m,"grabX",32)),Px(Number(m,"grabY",20)));animate=!Flag(m,"reduced");
            activeGesture=TextValue(m,"gestureId","");
            tracking=Flag(m,"dragging")&&GetAsyncKeyState(1)<0;
        }else{Point cursor;GetCursorPos(out cursor);grab=new Point(Px(35),Px(18));Location=new Point(cursor.X-grab.X,cursor.Y-grab.Y);tracking=false;}
        if(initialized){double dpi=96;try{dpi=GetDpiForWindow(Handle);}catch{}browser.ZoomFactor=Math.Max(.5,Math.Min(3,viewScale/(dpi/96)));}
        RoundCorners();
        if(tracking){TrackCursor();dragTimer.Start();}else ClampToScreen();
    }
    // This short-lived cursor loop bridges the existing press across processes.
    // It runs only while the button is held, including the final WebView startup.
    void TrackCursor(){
        if(stopping){tracking=false;dragTimer.Stop();return;}
        if(GetAsyncKeyState(1)>=0){tracking=false;dragTimer.Stop();UpdateAttachment();if(presented){Activate();browser.Focus();}return;}
        Point cursor;if(GetCursorPos(out cursor))Location=new Point(cursor.X-grab.X,cursor.Y-grab.Y);
    }
    Color Background(Dictionary<string,object> value){object item;var theme=value.TryGetValue("theme",out item)?item as Dictionary<string,object>:null;string color=theme==null?"":TextValue(theme,"background","");try{if(color.StartsWith("#"))return ColorTranslator.FromHtml(color);var parts=Regex.Matches(color,@"\d+(?:\.\d+)?");if(parts.Count>=3)return Color.FromArgb(Math.Min(255,(int)double.Parse(parts[0].Value,CultureInfo.InvariantCulture)),Math.Min(255,(int)double.Parse(parts[1].Value,CultureInfo.InvariantCulture)),Math.Min(255,(int)double.Parse(parts[2].Value,CultureInfo.InvariantCulture)));}catch{}return Color.FromArgb(43,43,46);}
    async Task Initialize(Dictionary<string,object> value){
        try{
            hello=value;PrepareGeometry(value);BackColor=Background(value);browser.DefaultBackgroundColor=BackColor;Progress("creating-window");
            // WebView initialization needs a shown native parent. It remains
            // fully transparent and nonactivating until the shared UI is ready.
            Opacity=0;Show(new OwnerHandle(owner));browser.CreateControl();var browserHandle=browser.Handle;
            Progress("environment");var options=new CoreWebView2EnvironmentOptions();options.AdditionalBrowserArguments="--disable-background-networking --no-first-run";
            var environment=await CoreWebView2Environment.CreateAsync(null,Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"webview-data"),options);if(stopping)return;
            Progress("initializing-webview");await browser.EnsureCoreWebView2Async(environment);if(stopping)return;
            initialized=true;double dpi=96;try{dpi=GetDpiForWindow(Handle);}catch{}browser.ZoomFactor=Math.Max(.5,Math.Min(3,viewScale/(dpi/96)));
            var core=browser.CoreWebView2;
            core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.AreHostObjectsAllowed=false;core.Settings.IsStatusBarEnabled=false;core.Settings.IsZoomControlEnabled=false;
            core.Settings.IsScriptEnabled=true;core.Settings.IsWebMessageEnabled=true;
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.addEventListener('error',e=>chrome.webview.postMessage({type:'bootError',detail:String(e.message||'').slice(0,160)}));window.addEventListener('securitypolicyviolation',e=>chrome.webview.postMessage({type:'bootError',detail:'CSP:'+e.violatedDirective}));");
            if(stopping)return;
            core.SetVirtualHostNameToFolderMapping("tanuki-rules.invalid",AppDomain.CurrentDomain.BaseDirectory,CoreWebView2HostResourceAccessKind.Deny);
            core.NavigationStarting+=delegate(object sender,CoreWebView2NavigationStartingEventArgs e){if(e.Uri==EditorUrl&&!uiReady){editorNavigation=e.NavigationId;Progress("loading-editor-document");}else e.Cancel=true;};
            core.NewWindowRequested+=delegate(object sender,CoreWebView2NewWindowRequestedEventArgs e){e.Handled=true;};
            core.PermissionRequested+=delegate(object sender,CoreWebView2PermissionRequestedEventArgs e){e.State=CoreWebView2PermissionState.Deny;};
            core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
            core.WebResourceRequested+=delegate(object sender,CoreWebView2WebResourceRequestedEventArgs e){if(e.Request.Uri!=EditorUrl)e.Response=environment.CreateWebResourceResponse(new MemoryStream(),403,"Blocked","");};
            core.ProcessFailed+=delegate{Fail();};core.WebMessageReceived+=OnWebMessage;
            core.NavigationCompleted+=delegate(object sender,CoreWebView2NavigationCompletedEventArgs e){
                // Only our exact local document owns the startup handshake.
                // Canceled bootstrap/external navigation IDs are unrelated.
                if(e.NavigationId!=editorNavigation)return;
                if(!e.IsSuccess)Fail("navigation-"+e.WebErrorStatus,null);else Progress(uiReady?"ready":"document-loaded");
            };
            Progress("loading-editor");core.Navigate(EditorUrl);
        }catch(Exception error){Fail(stage,error);}
    }
    void Present(){
        if(stopping||!uiReady||presented||presentation==null)return;
        BackColor=Background(presentation);browser.DefaultBackgroundColor=BackColor;
        Post(new{type="theme",theme=presentation["theme"],language=TextValue(presentation,"language","en")});Post(presentation);
        presented=true;InstallOwnerTracking();RoundCorners();Emit(new{type="transition"});
        if(tracking)TrackCursor();
        Opacity=tracking||!animate?1:0;if(!Visible)Show(new OwnerHandle(owner));
        if(!tracking){Activate();browser.Focus();if(animate){motionClock.Restart();motionTimer.Start();}}
        stage="ready";Emit(new{type="ready"});
    }
    void OnWebMessage(object sender,CoreWebView2WebMessageReceivedEventArgs e){
        try{
            if(stopping||e.WebMessageAsJson.Length>512*1024)return;var value=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);string type=TextValue(value,"type","");
            if(type=="bootError"){if(diagnostics)Emit(new{type="diagnostic",detail=TextValue(value,"detail","")});Fail("editor-script",null);return;}
            if(type=="pageReady"){Progress("page-script-ready");Post(hello);}
            else if(type=="uiReady"){
                if(uiReady)return;uiReady=true;stage="prepared";RoundCorners();Emit(new{type="prepared"});
                if(presentation!=null)Present();else Hide();
            }else if(type=="metrics"){radius=(float)Math.Max(0,Math.Min(40,Number(value,"radius",radius)));RoundCorners();}
            else if(type=="drag")QueueDrag(2,new Point(Px(Number(value,"grabX",32)),Px(Number(value,"grabY",20))));
            else if(type=="resize"){string edge=TextValue(value,"edge","");var codes=new Dictionary<string,int>{{"w",10},{"e",11},{"n",12},{"nw",13},{"ne",14},{"s",15},{"sw",16},{"se",17}};int code;if(codes.TryGetValue(edge,out code))QueueDrag(code);}
            else if(type=="edit"||type=="flushed")Emit(value);
            else if(type=="closed"||type=="attach"){Emit(value);BeginInvoke((Action)delegate{stopping=true;Close();});}
            else if(type=="refresh")Emit(value);
            else if(type=="pageError")Fail("editor-script",null);
        }catch(Exception error){Fail(stage,error);}
    }
    void QueueDrag(int hit,Point? offset=null){
        if(dragQueued||!presented)return;dragQueued=true;
        BeginInvoke((Action)delegate{
            dragQueued=false;if(stopping||GetAsyncKeyState(1)>=0)return;
            if(hit==2){Point cursor;if(GetCursorPos(out cursor)){activeGesture="";motionTimer.Stop();Opacity=1;grab=offset.HasValue?offset.Value:new Point(cursor.X-Left,cursor.Y-Top);tracking=true;TrackCursor();dragTimer.Start();}}
            else {Point cursor;GetCursorPos(out cursor);ReleaseCapture();SendMessage(Handle,0xA1,new IntPtr(hit),new IntPtr((cursor.Y<<16)|(cursor.X&0xffff)));ClampToScreen();UpdateAttachment();}
        });
    }
    void AnimateEntry(){if(stopping){motionTimer.Stop();return;}double p=duration<=0?1:Math.Min(1,motionClock.Elapsed.TotalMilliseconds/duration);Opacity=1-Math.Pow(1-p,3);if(p>=1){motionTimer.Stop();Opacity=1;}}
    void Receive(Dictionary<string,object> value){
        if(stopping)return;string type=TextValue(value,"type","");
        if(type=="shutdown"){SafeClose();return;}
        if(type=="hello"){if(hello==null){var pending=Initialize(value);}return;}
        if(type=="present"){if(!presented){presentation=value;PrepareGeometry(value);Present();}return;}
        if(type=="placement"){if(presentation!=null)PrepareGeometry(value);return;}
        if(type=="dragEnd"){
            object item;var motion=value.TryGetValue("motion",out item)?item as Dictionary<string,object>:null;
            if(motion!=null&&activeGesture!=""&&TextValue(motion,"gestureId","")==activeGesture){tracking=false;dragTimer.Stop();PrepareGeometry(value);UpdateAttachment();if(presented){Activate();browser.Focus();}}
            return;
        }
        if(type=="focus"){if(presented&&!IsIconic(owner)){if(!Visible)Show(new OwnerHandle(owner));Activate();browser.Focus();Post(value);}return;}
        if(type=="theme"){BackColor=Background(value);browser.DefaultBackgroundColor=BackColor;}Post(value);
    }
    void Progress(string value){stage=value;Emit(new{type="progress",stage=value});}
    void Fail(){Fail(stage,null);}
    void Fail(string at,Exception error){if(stopping)return;string code=error==null?"":error.GetType().Name+":"+error.HResult.ToString("X8");if(diagnostics&&error!=null)Emit(new{type="diagnostic",detail=error.ToString()});Emit(new{type="fatal",error="NATIVE_UNAVAILABLE",stage=at,detail=code});SafeClose();}
    void SafeClose(){try{if(IsHandleCreated&&!IsDisposed)BeginInvoke((Action)delegate{stopping=true;Hide();Close();Application.ExitThread();});}catch{}}
    protected override bool ShowWithoutActivation{get{return !presented||tracking;}}
    protected override CreateParams CreateParams{get{var value=base.CreateParams;value.ExStyle|=0x80;return value;}}
    [STAThread] static int Main(string[] args){try{output=new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true};int pid;if(args.Length!=1||!int.TryParse(args[0],out pid))return 2;var owner=FindOwner(pid);if(owner==IntPtr.Zero){Emit(new{type="fatal",stage="owner-window",detail="not-found"});return 3;}try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{SetProcessDPIAware();}Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);Application.ThreadException+=delegate(object sender,ThreadExceptionEventArgs e){if(active!=null)active.Fail(active.stage,e.Exception);};Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);active=new RulesWindow(pid,owner);var handle=active.Handle;var reader=new Thread(delegate(){try{var parser=new JavaScriptSerializer{MaxJsonLength=1024*1024};using(var input=new StreamReader(Console.OpenStandardInput(),Encoding.UTF8)){string line;while((line=input.ReadLine())!=null){if(line.Length>512*1024)break;var value=parser.Deserialize<Dictionary<string,object>>(line);active.BeginInvoke((Action)delegate{active.Receive(value);});}}}catch{}active.SafeClose();});reader.IsBackground=true;reader.Start();Application.Run();return 0;}catch(Exception error){if(diagnostics)Emit(new{type="diagnostic",detail=error.ToString()});Emit(new{type="fatal",stage="bootstrap",detail=error.GetType().Name+":"+error.HResult.ToString("X8")});return 1;}}
}
