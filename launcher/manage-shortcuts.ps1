param(
    [ValidateSet('Enable','Restore')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$StateRoot,
    [Parameter(Mandatory=$true)][string]$InstallDirectory,
    [Parameter(Mandatory=$true)][string]$ProfileDirectory,
    [string]$SourceLauncher,
    [string]$ShortcutRoot,
    [ValidateSet('zh','en')][string]$Locale='zh',
    [switch]$Incomplete
)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
$StateRoot=[IO.Path]::GetFullPath($StateRoot)
$InstallDirectory=[IO.Path]::GetFullPath($InstallDirectory)
$ProfileDirectory=[IO.Path]::GetFullPath($ProfileDirectory)
$launcher=Join-Path $StateRoot 'ProtectedLauncher.exe'
$app=Join-Path $InstallDirectory 'DeepSeek Harness.exe'
$journal=Join-Path $StateRoot 'shortcut-state.json'
$backupRoot=Join-Path $StateRoot 'shortcut-originals'
$reportPath=Join-Path $ProfileDirectory '.tanuki-toolbox\shortcut-status.json'
$failures=New-Object Collections.ArrayList
$records=@{}
$changed=0
function Save-Json([string]$File,$Value){
    [IO.Directory]::CreateDirectory((Split-Path -Parent $File))|Out-Null
    $temp=$File+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
    [IO.File]::WriteAllText($temp,($Value|ConvertTo-Json -Depth 16),(New-Object Text.UTF8Encoding($false)))
    if(Test-Path -LiteralPath $File){[IO.File]::Replace($temp,$File,[NullString]::Value)}else{[IO.File]::Move($temp,$File)}
}
function Save-Journal { Save-Json $journal @{schema=1;installDirectory=$InstallDirectory;profileDirectory=$ProfileDirectory;records=@($records.Values|Sort-Object Path)} }
function Under([string]$File,[string]$Root){return $File.Equals($Root,[StringComparison]::OrdinalIgnoreCase) -or $File.StartsWith($Root.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)}
function Add-Failure([string]$File,[string]$Code){[void]$failures.Add(@{path=$File;code=$Code})}
function Hash([string]$File){
    # The desktop host can inherit PowerShell 7's module path; Windows
    # PowerShell then cannot autoload Get-FileHash. Use the built-in .NET API.
    $algorithm=[Security.Cryptography.SHA256]::Create();$stream=[IO.File]::OpenRead($File)
    try{return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','')}finally{$stream.Dispose();$algorithm.Dispose()}
}
function Is-Protected($Link){return $Link.TargetPath -ieq $launcher}
function Is-Legacy($Link){
    $script=Join-Path $ProfileDirectory 'node_modules\dsh-local-plugin-center\launcher\start.vbs'
    return [IO.Path]::GetFileName($Link.TargetPath) -ieq 'wscript.exe' -and $Link.Arguments.Replace('/','\').IndexOf($script,[StringComparison]::OrdinalIgnoreCase) -ge 0
}
function Release-Com($Value){if($null -ne $Value){[Runtime.InteropServices.Marshal]::FinalReleaseComObject($Value)|Out-Null}}
$mutex=New-Object Threading.Mutex($false,('Local\TanukiShortcutManager-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value))
$locked=$false;$shell=$null
try{
    try{$locked=$mutex.WaitOne(60000)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(!$locked){throw 'Shortcut operation is already running.'}
    if(Test-Path -LiteralPath $journal){
        $saved=Get-Content -LiteralPath $journal -Raw -Encoding UTF8|ConvertFrom-Json
        if($saved.profileDirectory -ine $ProfileDirectory -or $saved.installDirectory -ine $InstallDirectory){throw 'Shortcuts belong to another DSH profile or installation.'}
        foreach($record in $saved.records){$records[$record.Path]=$record}
    }
    if($Mode -eq 'Enable'){
        if(!(Test-Path -LiteralPath $app) -or !(Test-Path -LiteralPath (Join-Path $ProfileDirectory 'node_modules\dsh-local-plugin-center\launcher\launch.cjs'))){throw 'DSH or Tanuki Toolbox is missing.'}
        [IO.Directory]::CreateDirectory($StateRoot)|Out-Null
        if($SourceLauncher -and [IO.Path]::GetFullPath($SourceLauncher) -ine $launcher){
            if(!(Test-Path -LiteralPath $launcher) -or (Hash $SourceLauncher) -ne (Hash $launcher)){Copy-Item -LiteralPath $SourceLauncher -Destination $launcher -Force}
        }
        if(!(Test-Path -LiteralPath $launcher)){throw 'Protected launcher is missing.'}
        Save-Json (Join-Path $StateRoot 'settings.json') @{schema=1;installDirectory=$InstallDirectory;dshHome=(Split-Path -Parent (Split-Path -Parent $ProfileDirectory));profileDirectory=$ProfileDirectory;installComplete=(!$Incomplete);configuredBy='startup-guard';locale=$Locale}
    }
    $shell=New-Object -ComObject WScript.Shell
    $candidates=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $roots=if($ShortcutRoot){@($ShortcutRoot)}else{@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'),(Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch'),$env:USERPROFILE)}
    foreach($root in @($roots|Where-Object {$_}|Select-Object -Unique)){
        if(!(Test-Path -LiteralPath $root)){continue}
        $stack=New-Object 'Collections.Generic.Stack[string]';$stack.Push($root)
        while($stack.Count){
            $dir=$stack.Pop();if(Under $dir $StateRoot){continue}
            foreach($item in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)){
                if($item.PSIsContainer){
                    if($item.Name -match '^(AppData|node_modules|\.git|\.codex|\.dsh|\.cache|backups|shortcut-backups|installer-test-.*|\$.*)$'){continue}
                    if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($item.Attributes -band [IO.FileAttributes]::Offline)){continue}
                    $stack.Push($item.FullName)
                }elseif($item.Extension -ieq '.lnk' -and !($item.Attributes -band [IO.FileAttributes]::Offline)){[void]$candidates.Add($item.FullName)}
            }
        }
    }
    # Windows Search includes indexed shortcut locations outside the user folders.
    if(!$ShortcutRoot){
        $connection=$null;$reader=$null
        try{
            $connection=New-Object Data.OleDb.OleDbConnection('Provider=Search.CollatorDSO;Extended Properties="Application=Windows";')
            $connection.Open();$command=$connection.CreateCommand();$command.CommandTimeout=8
            $command.CommandText="SELECT TOP 20000 System.ItemPathDisplay FROM SYSTEMINDEX WHERE System.FileExtension = '.lnk'"
            $reader=$command.ExecuteReader()
            while($reader.Read()){
                $file=[string]$reader.GetValue(0)
                if([IO.Path]::IsPathRooted($file) -and !(Under $file $StateRoot) -and $file -notmatch '\\(node_modules|\.git|\.codex|\.dsh|backups|shortcut-backups|installer-test-[^\\]+)\\' -and (Test-Path -LiteralPath $file)){[void]$candidates.Add($file)}
            }
        }catch{}finally{if($reader){$reader.Dispose()};if($connection){$connection.Dispose()}}
    }
    foreach($record in $records.Values){if($record.Active -and (Test-Path -LiteralPath $record.Path)){[void]$candidates.Add($record.Path)}}
    # Import original files saved by the previous one-click installer.
    $legacyBackups=@{}
    $oldIndex=Join-Path $StateRoot 'shortcut-backups\latest.json'
    if(Test-Path -LiteralPath $oldIndex){try{foreach($entry in (Get-Content -LiteralPath $oldIndex -Raw -Encoding UTF8|ConvertFrom-Json)){$legacyBackups[$entry.Path]=$entry.Backup}}catch{}}
    foreach($file in $candidates){
        $link=$null;$matched=$false
        try{
            $link=$shell.CreateShortcut($file)
            $record=$records[$file];$protected=Is-Protected $link;$legacy=Is-Legacy $link
            if($Mode -eq 'Enable'){
                if($link.TargetPath -ine $app -and !$protected -and !$legacy){if($record -and $record.Active){$record.Active=$false;Save-Journal;Add-Failure $file 'changed'};continue}
                $matched=$true
                if($record -and $record.Active -and $protected){
                    if($record.ManagedHash -and (Hash $file) -ne $record.ManagedHash){Add-Failure $file 'changed'}
                    continue
                }
                if($record -and $record.Active -and !$protected -and (Hash $file) -ne $record.ManagedHash){
                    # A host update can recreate the original DSH shortcut; capture that fresh original.
                    $record.Active=$false
                }
                [IO.Directory]::CreateDirectory($backupRoot)|Out-Null
                $backup=Join-Path $backupRoot ([Guid]::NewGuid().ToString('N')+'.lnk')
                $old=$legacyBackups[$file]
                if($protected -and $old -and (Test-Path -LiteralPath $old)){Copy-Item -LiteralPath $old -Destination $backup}
                else{Copy-Item -LiteralPath $file -Destination $backup}
                # Old protected-only links had no original app shortcut; make a normal DSH baseline.
                $original=$shell.CreateShortcut($backup)
                try{if((Is-Protected $original) -or (Is-Legacy $original)){$wasLegacy=Is-Legacy $original;$original.TargetPath=$app;if($wasLegacy){$original.Arguments=''};$original.WorkingDirectory=$InstallDirectory;$original.Description='DeepSeek Harness';$original.IconLocation=$app+',0';$original.Save()}}finally{Release-Com $original}
                $record=[PSCustomObject]@{Path=$file;Backup=$backup;OriginalHash=(Hash $backup);ManagedHash=$null;Active=$true}
                $records[$file]=$record;Save-Journal
                $args=$link.Arguments;if($legacy){$args=''}
                $link.TargetPath=$launcher;$link.Arguments=$args;$link.WorkingDirectory=$StateRoot;$link.IconLocation=$app+',0'
                $link.Description='DeepSeek Harness - Tanuki Protected Launch';$link.Save()
                $record.ManagedHash=Hash $file;Save-Journal;$changed++
            }else{
                if($record -and $record.Active){
                    $matched=$true
                    if(!$protected){$record.Active=$false;Save-Journal;continue}
                    if($record.ManagedHash -and (Hash $file) -ne $record.ManagedHash){Add-Failure $file 'changed';continue}
                    if(!(Test-Path -LiteralPath $record.Backup) -or (Hash $record.Backup) -ne $record.OriginalHash){Add-Failure $file 'backup-missing';continue}
                    Release-Com $link;$link=$null
                    Copy-Item -LiteralPath $record.Backup -Destination $file -Force
                    $record.Active=$false;Save-Journal;$changed++
                }elseif($protected -or $legacy){
                    $matched=$true
                    # Handle copied/pinned protected links created after the initial capture.
                    $old=$legacyBackups[$file]
                    if($old -and (Test-Path -LiteralPath $old)){Release-Com $link;$link=$null;Copy-Item -LiteralPath $old -Destination $file -Force}
                    else{$link.TargetPath=$app;if($legacy){$link.Arguments=''};$link.WorkingDirectory=$InstallDirectory;$link.Description='DeepSeek Harness';$link.IconLocation=$app+',0';$link.Save()}
                    $changed++
                }
            }
        }catch{if($matched -or ($records[$file] -and $records[$file].Active)){Add-Failure $file 'access-denied'}}finally{Release-Com $link}
    }
    $managed=@($records.Values|Where-Object {$_.Active -and (Test-Path -LiteralPath $_.Path)}).Count
    $status=if($failures.Count){'partial'}elseif($Mode -eq 'Restore'){'restored'}elseif(!$managed){'none'}else{'enabled'}
    Save-Json $reportPath @{status=$status;mode=$Mode.ToLowerInvariant();managed=$managed;changed=$changed;warnings=@($failures.ToArray());at=(Get-Date).ToUniversalTime().ToString('o')}
    [Console]::WriteLine(($status+': '+$managed+' protected, '+$changed+' changed, '+$failures.Count+' unresolved.'))
}catch{
    Save-Json $reportPath @{status='error';mode=$Mode.ToLowerInvariant();managed=0;changed=$changed;warnings=@(@{code='operation-failed'});detail=$_.Exception.Message;at=(Get-Date).ToUniversalTime().ToString('o')}
    [Console]::Error.WriteLine($_.Exception.Message);exit 1
}finally{Release-Com $shell;if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
