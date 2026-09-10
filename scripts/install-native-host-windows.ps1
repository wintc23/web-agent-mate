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
    Push-Location $ProjectDir
    try { npm run build:runtime; if ($LASTEXITCODE -ne 0) { throw 'Runtime build failed' } } finally { Pop-Location }
    cargo build --manifest-path $Manifest --release
  } else {
    throw 'Bridge binary is missing. Download the Windows release package.'
  }
}

New-Item -ItemType Directory -Force -Path $BinaryDir | Out-Null
Copy-Item -Force $SourceBinary $BinaryPath
$RuntimeSource = Join-Path $ProjectDir 'bridge\runtime-dist\agent.mjs'
if (Test-Path (Join-Path $PSScriptRoot 'runtime\agent.mjs')) { $RuntimeSource = Join-Path $PSScriptRoot 'runtime\agent.mjs' }
if (-not (Test-Path $RuntimeSource)) { throw 'Runtime bundle missing. Run npm run build:runtime first.' }
$RuntimeDir = Join-Path $BinaryDir 'runtime'
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Copy-Item -Force $RuntimeSource (Join-Path $RuntimeDir 'agent.mjs')
$RuntimeLicenses = Join-Path (Split-Path $RuntimeSource -Parent) 'licenses'
if (Test-Path $RuntimeLicenses) { Copy-Item $RuntimeLicenses $RuntimeDir -Recurse -Force }
$BundledNode = Join-Path (Split-Path $RuntimeSource -Parent) 'node'
if (Test-Path $BundledNode) { Copy-Item $BundledNode $RuntimeDir -Recurse -Force }

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
