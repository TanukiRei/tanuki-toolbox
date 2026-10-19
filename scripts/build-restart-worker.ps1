$ErrorActionPreference='Stop'
$pluginRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(!(Test-Path -LiteralPath $compiler)){throw 'The Windows .NET Framework C# compiler is required.'}
& $compiler '/nologo' '/target:winexe' '/platform:x64' '/optimize+' '/utf8output' '/codepage:65001' '/reference:System.Core.dll' '/reference:System.Windows.Forms.dll' '/reference:System.Web.Extensions.dll' ('/out:'+(Join-Path $pluginRoot 'launcher/RestartWorker.exe')) (Join-Path $pluginRoot 'launcher/RestartWorker.cs')
if($LASTEXITCODE -ne 0){throw 'Restart worker compilation failed.'}
$build=@{sourceSha256=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'launcher/RestartWorker.cs') -Algorithm SHA256).Hash.ToLowerInvariant();binarySha256=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'launcher/RestartWorker.exe') -Algorithm SHA256).Hash.ToLowerInvariant()}
[IO.File]::WriteAllText((Join-Path $pluginRoot 'launcher/RestartWorker.build.json'),($build|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
