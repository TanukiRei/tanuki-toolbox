$ErrorActionPreference='Stop'
$pluginRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(!(Test-Path -LiteralPath $compiler)){throw 'The Windows .NET Framework C# compiler is required.'}
$webview=Join-Path $pluginRoot 'launcher/webview2'
& $compiler '/nologo' '/target:winexe' '/platform:x64' '/optimize+' '/utf8output' '/codepage:65001' '/reference:System.Core.dll' '/reference:System.Drawing.dll' '/reference:System.Windows.Forms.dll' '/reference:System.Web.Extensions.dll' ('/reference:'+(Join-Path $webview 'Microsoft.Web.WebView2.Core.dll')) ('/reference:'+(Join-Path $webview 'Microsoft.Web.WebView2.WinForms.dll')) ('/out:'+(Join-Path $pluginRoot 'launcher/RulesWindow.exe')) (Join-Path $pluginRoot 'launcher/RulesWindow.cs')
if($LASTEXITCODE -ne 0){throw 'Rules window compilation failed.'}
$build=@{sourceSha256=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'launcher/RulesWindow.cs') -Algorithm SHA256).Hash.ToLowerInvariant();binarySha256=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'launcher/RulesWindow.exe') -Algorithm SHA256).Hash.ToLowerInvariant()}
$build.assets=@{}
foreach($file in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll')){$build.assets['webview2/'+$file]=(Get-FileHash -LiteralPath (Join-Path $webview $file) -Algorithm SHA256).Hash.ToLowerInvariant()}
[IO.File]::WriteAllText((Join-Path $pluginRoot 'launcher/RulesWindow.build.json'),($build|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
