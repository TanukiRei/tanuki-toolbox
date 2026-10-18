param(
    [ValidateSet('Probe','Restart')][string]$Mode='Probe',
    [Parameter(Mandatory=$true)][int]$HostId,
    [Parameter(Mandatory=$true)][string]$HostPath,
    [Parameter(Mandatory=$true)][string]$ProfilePath,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$LauncherHash,
    [string]$HostBorn,
    [int]$DesktopId=0,
    [string]$DesktopBorn,
    [string]$Receipt
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding $false
$OutputEncoding=[Console]::OutputEncoding
$stage='HELPER_INITIALIZATION_FAILED'
$accepted=$false
function Identity($p) {
    # CIM has microsecond precision; native FILETIME has 100ns precision. Keep
    # native integers as strings across JSON/PowerShell/Node, never JS numbers.
    $handle=[TanukiRestartNative]::OpenProcess(0x101000,$false,[int]$p.ProcessId)
    if($handle -eq [IntPtr]::Zero){throw 'PROCESS_QUERY_DENIED'}
    try {
        $name=New-Object Text.StringBuilder 32768;$length=$name.Capacity
        [long]$created=0;[long]$exited=0;[long]$kernel=0;[long]$user=0
        if(![TanukiRestartNative]::QueryFullProcessImageName($handle,0,$name,[ref]$length) -or ![TanukiRestartNative]::GetProcessTimes($handle,[ref]$created,[ref]$exited,[ref]$kernel,[ref]$user)){throw 'PROCESS_QUERY_FAILED'}
        if(!$p.CreationDate){throw 'PROCESS_CREATION_TIME_MISSING'}
        [long]$delta=$created-$p.CreationDate.ToUniversalTime().ToFileTimeUtc()
        if($delta -lt 0 -or $delta -ge 10 -or $name.ToString() -ine $p.ExecutablePath -or [TanukiRestartNative]::WaitForSingleObject($handle,0) -ne 258){throw 'INSTANCE_CHANGED'}
        return @{pid=[int]$p.ProcessId;born=$created.ToString([Globalization.CultureInfo]::InvariantCulture);path=$name.ToString()}
    } finally {[void][TanukiRestartNative]::CloseHandle($handle)}
}
function Publish($value) {
    $json=$value | ConvertTo-Json -Compress -Depth 5
    if($Mode -eq 'Probe'){[Console]::Out.WriteLine($json)}
    elseif($Receipt){[IO.File]::WriteAllText($Receipt+'.tmp',$json);Move-Item -LiteralPath ($Receipt+'.tmp') -Destination $Receipt -Force}
}
try {
    if($Mode -eq 'Restart' -and (!$Receipt -or ![IO.Path]::IsPathRooted($Receipt) -or $HostBorn -notmatch '^\d{17,19}$' -or $DesktopBorn -notmatch '^\d{17,19}$' -or $DesktopId -le 0)){throw 'RESTART_ARGUMENTS_INVALID'}
    # Settings are an allowlist, never a source of arbitrary command arguments.
    $state=Join-Path $env:LOCALAPPDATA 'TanukiToolbox'
    $settingsPath=Join-Path $state 'settings.json'
    $stage='SETTINGS_READ_FAILED'
    $settings=Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($settings.installComplete -ne $true){throw 'REOPEN_NOT_READY'}
    foreach($key in @('installDirectory','profileDirectory','dshHome')){if($settings.$key -isnot [string] -or ![IO.Path]::IsPathRooted($settings.$key)){throw 'REOPEN_SETTINGS_INVALID'}}
    if(!(Test-Path -LiteralPath $settings.dshHome -PathType Container)){throw 'REOPEN_HOME_MISSING'}
    $app=[IO.Path]::GetFullPath((Join-Path $settings.installDirectory 'DeepSeek Harness.exe'))
    if([IO.Path]::GetFullPath($HostPath) -ine $app){throw 'INSTALL_MISMATCH'}
    $launcher=Join-Path $state 'ProtectedLauncher.exe'
    $profile=[IO.Path]::GetFullPath($settings.profileDirectory)
    if($profile -ine [IO.Path]::GetFullPath($ProfilePath)){throw 'PROFILE_MISMATCH'}
    $launchScript=Join-Path $profile 'node_modules\dsh-local-plugin-center\launcher\launch.cjs'
    foreach($file in @($app,$launcher,$launchScript)){if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw 'REOPEN_NOT_READY'}}
    if((Get-FileHash -LiteralPath $launcher -Algorithm SHA256).Hash -ine $LauncherHash){throw 'REOPEN_LAUNCHER_MISMATCH'}
    $stage='NATIVE_IDENTITY_UNAVAILABLE'
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TanukiRestartNative {
 [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr p,uint flags,StringBuilder name,ref int length);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetProcessTimes(IntPtr p,out long created,out long exited,out long kernel,out long user);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool TerminateProcess(IntPtr p,uint code);
 [DllImport("kernel32.dll")] public static extern uint WaitForSingleObject(IntPtr p,uint timeout);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr p);
}
'@
    $stage='PROCESS_SNAPSHOT_FAILED'
    $all=@(Get-CimInstance Win32_Process)
    $byId=@{};foreach($p in $all){$byId[[int]$p.ProcessId]=$p}
    $hostProcess=$byId[$HostId]
    if(!$hostProcess -or $hostProcess.ExecutablePath -ine $app){throw 'HOST_IDENTITY_MISMATCH'}
    # Walk only a contiguous same-executable ancestry, never process names.
    $desktop=$hostProcess;$seen=@{}
    while($true){
        if($seen.ContainsKey([int]$desktop.ProcessId)){throw 'INSTANCE_NOT_IDENTIFIED'}
        $seen[[int]$desktop.ProcessId]=$true
        $parent=$byId[[int]$desktop.ParentProcessId]
        if(!$parent -or $parent.ExecutablePath -ine $app){break}
        if($parent.CreationDate -gt $desktop.CreationDate){throw 'INSTANCE_NOT_IDENTIFIED'}
        $desktop=$parent
    }
    if($desktop.ProcessId -eq $HostId -or !$desktop.CommandLine -or $desktop.CommandLine -match '(?i)--type[=\s]|--expose-internals|\.(?:cjs|mjs|js)(?:\s|"|$)'){throw 'INSTANCE_NOT_IDENTIFIED'}
    $stage='PROCESS_IDENTITY_FAILED'
    $h=Identity $hostProcess;$d=Identity $desktop
    # Only the identified root's same-executable descendants are eligible.
    $targets=@($desktop);$ids=@{};$ids[$d.pid]=$true
    do {$added=$false;foreach($p in $all){if(!$ids.ContainsKey([int]$p.ProcessId) -and $ids.ContainsKey([int]$p.ParentProcessId) -and $p.ExecutablePath -ieq $app -and $p.CreationDate -ge $byId[[int]$p.ParentProcessId].CreationDate){$targets+=,$p;$ids[[int]$p.ProcessId]=$true;$added=$true}}}while($added)
    if(!$ids.ContainsKey($HostId)){throw 'INSTANCE_CHANGED'}
    # The existing protected launcher skips preflight if ANY DSH exe is running.
    # Refuse concurrent instances (including other installations), never terminate them.
    foreach($p in $all){if($p.Name -ieq 'DeepSeek Harness.exe' -and !$ids.ContainsKey([int]$p.ProcessId)){throw 'OTHER_INSTANCE_RUNNING'}}
    $identities=@{};foreach($p in $targets){$identities[[int]$p.ProcessId]=Identity $p}
    if($identities[$HostId].born -cne $h.born -or $identities[$d.pid].born -cne $d.born){throw 'INSTANCE_CHANGED'}
    foreach($p in $targets){if([int]$p.ProcessId -ne $d.pid -and [long]$identities[[int]$p.ParentProcessId].born -gt [long]$identities[[int]$p.ProcessId].born){throw 'INSTANCE_CHANGED'}}
    if($Mode -eq 'Probe'){Publish @{available=$true;code='READY';host=$h;desktop=$d};exit 0}
    if($HostBorn -cne $h.born -or $DesktopId -ne $d.pid -or $DesktopBorn -cne $d.born){throw 'INSTANCE_CHANGED'}
    # Pin Windows handles and verify creation time + image on those same handles;
    # a PID recycled between WMI lookup and termination is never terminated.

    $handles=New-Object 'System.Collections.Generic.List[IntPtr]'
    $locks=New-Object 'System.Collections.Generic.List[System.IO.FileStream]'
    try {
        # Hold reopen files against replacement/deletion through the destructive stage.
        $stage='REOPEN_LOCK_FAILED'
        foreach($file in @($settingsPath,$app,$launcher,$launchScript)){$locks.Add([IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read))}
        if((Get-FileHash -LiteralPath $launcher -Algorithm SHA256).Hash -ine $LauncherHash){throw 'REOPEN_LAUNCHER_MISMATCH'}
        $lockedSettings=[IO.File]::ReadAllText($settingsPath)|ConvertFrom-Json
        if($lockedSettings.installComplete -ne $true -or $lockedSettings.installDirectory -ine $settings.installDirectory -or $lockedSettings.profileDirectory -ine $settings.profileDirectory -or $lockedSettings.dshHome -ine $settings.dshHome){throw 'REOPEN_CHANGED'}
        $stage='PROCESS_HANDLE_FAILED'
        foreach($p in $targets){
            $handle=[TanukiRestartNative]::OpenProcess(0x101001,$false,[int]$p.ProcessId)
            if($handle -eq [IntPtr]::Zero){throw 'INSTANCE_CHANGED'}
            $handles.Add($handle)
            $name=New-Object Text.StringBuilder 32768;$length=$name.Capacity
            [long]$created=0;[long]$exited=0;[long]$kernel=0;[long]$user=0
            if(![TanukiRestartNative]::QueryFullProcessImageName($handle,0,$name,[ref]$length) -or ![TanukiRestartNative]::GetProcessTimes($handle,[ref]$created,[ref]$exited,[ref]$kernel,[ref]$user) -or $name.ToString() -ine $app -or $created.ToString([Globalization.CultureInfo]::InvariantCulture) -cne $identities[[int]$p.ProcessId].born -or [TanukiRestartNative]::WaitForSingleObject($handle,0) -ne 258){throw 'INSTANCE_CHANGED'}
        }
        $stage='RECEIPT_WRITE_FAILED'
        Publish @{status='accepted';code='RESTART_ACCEPTED'}
        $accepted=$true
        # Give the authenticated POST a brief opportunity to deliver its acknowledgement.
        Start-Sleep -Milliseconds 1500
        # Root shutdown may concurrently exit a child between Wait and Terminate.
        # Attempt every pinned handle, then judge only the confirmed final states.
        $terminateFailed=$false
        foreach($handle in $handles){if([TanukiRestartNative]::WaitForSingleObject($handle,0) -eq 258){if(![TanukiRestartNative]::TerminateProcess($handle,1)){$terminateFailed=$true}}}
        $exitTimedOut=$false
        foreach($handle in $handles){if([TanukiRestartNative]::WaitForSingleObject($handle,15000) -ne 0){$exitTimedOut=$true}}
        if($exitTimedOut){if($terminateFailed){throw 'TERMINATE_FAILED'}else{throw 'EXIT_TIMEOUT'}}
        # A process started after the snapshot is NOT ours to kill. Do not allow
        # the protected launcher to skip preflight because such a process remains.
        $stage='REMAINING_INSTANCE_CHECK_FAILED'
        if(@(Get-CimInstance Win32_Process -Filter "Name = 'DeepSeek Harness.exe'").Count -ne 0){throw 'REMAINING_INSTANCE_RUNNING'}
        # No shell, no arguments or executable paths supplied by the HTTP caller.
        $start=New-Object Diagnostics.ProcessStartInfo
        $start.FileName=$launcher;$start.WorkingDirectory=$state;$start.UseShellExecute=$false
        foreach($key in @('ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH')){$start.EnvironmentVariables.Remove($key)}
        $stage='REOPEN_FAILED'
        $child=[Diagnostics.Process]::Start($start)
        if(!$child){throw 'REOPEN_FAILED'}
        Publish @{status='launched';code='PROTECTED_LAUNCH_STARTED'}
    } finally {foreach($handle in $handles){[void][TanukiRestartNative]::CloseHandle($handle)};foreach($lock in $locks){$lock.Dispose()}}
} catch {
    $code=$_.Exception.Message
    if($code -notmatch '^[A-Z_]+$'){$code=$stage}
    [Console]::Error.WriteLine(('Tanuki restart: {0}; {1}' -f $code,$_.Exception.Message))
    $status=if($accepted){'failed'}else{'unavailable'}
    try {Publish @{available=$false;status=$status;code=$code}} catch {[Console]::Error.WriteLine('RECEIPT_WRITE_FAILED: '+$_.Exception.Message)}
    exit 1
}
