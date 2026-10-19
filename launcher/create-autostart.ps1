param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$Launcher
)
$ErrorActionPreference='Stop'
if(-not [IO.Path]::IsPathRooted($OutputPath) -or -not [IO.Path]::IsPathRooted($Launcher) -or [IO.Path]::GetExtension($OutputPath) -ine '.lnk' -or -not (Test-Path -LiteralPath $Launcher -PathType Leaf)){throw 'Invalid shortcut destination'}
$shell=New-Object -ComObject WScript.Shell
try {
  $link=$shell.CreateShortcut($OutputPath)
  $link.TargetPath=$Launcher
  $link.Arguments=''
  $link.WorkingDirectory=[IO.Path]::GetDirectoryName($Launcher)
  $link.Description='Tanuki Toolbox - DeepSeek Harness protected login startup'
  $link.IconLocation=$Launcher+',0'
  $link.Save()
} finally {
  if($link){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}
