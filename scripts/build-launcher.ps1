$ErrorActionPreference='Stop'
$pluginRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(!(Test-Path -LiteralPath $compiler)){throw 'The Windows .NET Framework C# compiler is required.'}
$tempIcon=Join-Path ([IO.Path]::GetTempPath()) ('tanuki-'+[Guid]::NewGuid().ToString('N')+'.ico')
try {
    $png=[IO.File]::ReadAllBytes((Join-Path $pluginRoot 'assets/toolbox.png'))
    $stream=[IO.File]::Create($tempIcon)
    $writer=[IO.BinaryWriter]::new($stream)
    try {
        $writer.Write([UInt16]0);$writer.Write([UInt16]1);$writer.Write([UInt16]1)
        $writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0)
        $writer.Write([UInt16]1);$writer.Write([UInt16]32)
        $writer.Write([UInt32]$png.Length);$writer.Write([UInt32]22);$writer.Write($png)
    } finally {$writer.Dispose()}
    & $compiler '/nologo' '/target:winexe' '/platform:x64' '/optimize+' '/utf8output' ('/win32icon:'+$tempIcon) '/reference:System.Windows.Forms.dll' '/reference:System.Drawing.dll' '/reference:System.Web.Extensions.dll' ('/out:'+(Join-Path $pluginRoot 'launcher/ProtectedLauncher.exe')) (Join-Path $pluginRoot 'launcher/ProtectedLauncher.cs')
    if($LASTEXITCODE -ne 0){throw 'Launcher compilation failed.'}
} finally {if(Test-Path -LiteralPath $tempIcon){Remove-Item -LiteralPath $tempIcon}}
