param(
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId = 'lmlkkallnnjijicmfmfdelnamcnhflfg'
)
$ErrorActionPreference = 'Stop'

$ProjectDir = Split-Path -Parent $PSScriptRoot
$SourceBinary = Join-Path $PSScriptRoot 'webagentmate-bridge.exe'
if (-not (Test-Path $SourceBinary)) {
  $SourceBinary = Join-Path $ProjectDir 'bridge\target\release\webagentmate-bridge.exe'
}
$InstallRoot = Join-Path $env:LOCALAPPDATA 'WebAgentMate'
$BinaryDir = Join-Path $InstallRoot 'bin'
$BinaryPath = Join-Path $BinaryDir 'webagentmate-bridge.exe'
$ManifestPath = Join-Path $InstallRoot 'ai.webagentmate.bridge.json'

if (-not (Test-Path $SourceBinary)) {
  $Manifest = Join-Path $ProjectDir 'bridge\Cargo.toml'
  if (Test-Path $Manifest) {
    cargo build --manifest-path $Manifest --release
  } else {
    throw 'Bridge binary is missing. Download the Windows release package.'
  }
}

New-Item -ItemType Directory -Force -Path $BinaryDir | Out-Null
Copy-Item -Force $SourceBinary $BinaryPath

$Manifest = @{
  name = 'ai.webagentmate.bridge'
  description = 'WebAgentMate native bridge'
  path = $BinaryPath
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$Manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $ManifestPath

foreach ($Browser in @('Google\Chrome', 'Chromium', 'Microsoft\Edge')) {
  $RegistryPath = "HKCU:\Software\$Browser\NativeMessagingHosts\ai.webagentmate.bridge"
  New-Item -Force $RegistryPath | Out-Null
  Set-Item -Path $RegistryPath -Value $ManifestPath
}
Write-Host "Installed WebAgentMate Bridge for extension: $ExtensionId"
