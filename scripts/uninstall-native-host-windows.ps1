$ErrorActionPreference = 'Stop'
$ConnectorRoot = Join-Path $env:LOCALAPPDATA 'WebAgentMate'
$Launcher = Join-Path $ConnectorRoot 'launcher\webagentmate-launcher.exe'
if (Test-Path $Launcher) {
  & $Launcher --uninstall
  if ($LASTEXITCODE -ne 0) { throw 'Close Chrome and retry uninstalling Connector.' }
  foreach ($Entry in @('versions', 'launcher', 'updates', 'active.json')) {
    $Target = Join-Path $ConnectorRoot $Entry
    if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
  }
  Write-Host 'Connector uninstalled. Conversation data was preserved.'
  exit
}
foreach ($Browser in @('Google\Chrome', 'Chromium', 'Microsoft\Edge')) {
  $RegistryPath = "HKCU:\Software\$Browser\NativeMessagingHosts\ai.webagentmate.bridge"
  if (Test-Path $RegistryPath) { Remove-Item -Recurse -Force $RegistryPath }
}
$Binary = Join-Path $env:LOCALAPPDATA 'WebAgentMate\bin\webagentmate-bridge.exe'
if (Test-Path $Binary) { Rename-Item -Force $Binary 'webagentmate-bridge.exe.disabled' }
Write-Host 'WebAgentMate Native Messaging host disabled. Local conversation data was preserved.'
