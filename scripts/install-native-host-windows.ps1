param(
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId = 'lmlkkallnnjijicmfmfdelnamcnhflfg'
)
$ErrorActionPreference = 'Stop'
$ProjectDir = Split-Path -Parent $PSScriptRoot
$Payload = $PSScriptRoot
# Only maintainers build from source. Downloaded packages carry their own Node.
if (Test-Path (Join-Path $ProjectDir 'bridge/Cargo.toml')) {
  $Binary = Join-Path $ProjectDir 'bridge/target/release/webagentmate-bridge.exe'
  if (-not (Test-Path $Binary) -or -not (Test-Path (Join-Path $ProjectDir 'bridge/runtime-dist/agent.mjs'))) {
    Push-Location $ProjectDir
    try {
      npm run build:runtime
      if ($LASTEXITCODE -ne 0) { throw 'Runtime build failed' }
      cargo build --manifest-path bridge/Cargo.toml --release
      if ($LASTEXITCODE -ne 0) { throw 'Bridge build failed' }
    } finally { Pop-Location }
  }
  $Payload = Join-Path $ProjectDir 'build/installer-payload'
  $Arch = node -p process.arch
  node (Join-Path $ProjectDir 'scripts/installer/prepare.cjs') --platform win32 --arch $Arch --binary $Binary --out $Payload
  if ($LASTEXITCODE -ne 0) { throw 'Installer payload build failed' }
}
$PrivateNode = Join-Path $Payload 'runtime/node/node.exe'
foreach ($File in @($PrivateNode, (Join-Path $Payload 'setup.cjs'), (Join-Path $Payload 'bundle.json'))) {
  if (-not (Test-Path $File)) { throw 'Incomplete Connector package. Download and extract the complete package again.' }
}
& $PrivateNode (Join-Path $Payload 'setup.cjs') install $Payload $ExtensionId
if ($LASTEXITCODE -ne 0) { throw 'Connector installation failed' }
Write-Host 'Installed WebAgentMate Connector. Restart Chrome or reload the extension.'
