$ErrorActionPreference = 'Stop'
foreach ($Browser in @('Google\Chrome', 'Chromium', 'Microsoft\Edge')) {
  $RegistryPath = "HKCU:\Software\$Browser\NativeMessagingHosts\ai.webagentmate.bridge"
  if (Test-Path $RegistryPath) { Remove-Item -Recurse -Force $RegistryPath }
}
$Binary = Join-Path $env:LOCALAPPDATA 'WebAgentMate\bin\webagentmate-bridge.exe'
if (Test-Path $Binary) { Rename-Item -Force $Binary 'webagentmate-bridge.exe.disabled' }
Write-Host 'WebAgentMate Native Messaging host disabled. Local conversation data was preserved.'
