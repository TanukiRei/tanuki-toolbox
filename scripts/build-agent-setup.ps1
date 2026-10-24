$ErrorActionPreference='Stop'
$pluginRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(!(Test-Path -LiteralPath $compiler)){throw 'Windows .NET Framework C# compiler required.'}
& $compiler '/nologo' '/target:winexe' '/platform:anycpu' '/optimize+' '/utf8output' '/codepage:65001' '/reference:System.Web.Extensions.dll' ('/out:'+(Join-Path $pluginRoot 'launcher/AgentSetup.exe')) (Join-Path $pluginRoot 'launcher/AgentSetup.cs')
if($LASTEXITCODE -ne 0){throw 'Agent setup compilation failed.'}
$build=@{sourceSha256=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'launcher/AgentSetup.cs') -Algorithm SHA256).Hash.ToLowerInvariant();binarySha256=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'launcher/AgentSetup.exe') -Algorithm SHA256).Hash.ToLowerInvariant()}
[IO.File]::WriteAllText((Join-Path $pluginRoot 'launcher/AgentSetup.build.json'),($build|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
