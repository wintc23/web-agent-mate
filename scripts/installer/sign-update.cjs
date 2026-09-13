// The release signature authenticates the full packages including the private Node.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function signRelease(directory, privateKey, publicKey = require('./update-key.json')) {
  const key = crypto.createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ed25519' || crypto.createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64') !== publicKey.spki) throw new Error('Update signing key does not match the pinned public key');
  const version = require('../../public/manifest.json').version;
  const assets = {};
  for (const [name, platform, arch] of [['macos-x64', 'darwin', 'x64'], ['macos-arm64', 'darwin', 'arm64'], ['windows-x64', 'win32', 'x64'], ['linux-x64', 'linux', 'x64']]) {
    const file = `webagentmate-bridge-${name}.zip`;
    const bytes = fs.readFileSync(path.join(directory, file));
    assets[`${platform}-${arch}`] = { url: `https://github.com/wintc23/web-agent-mate/releases/download/v${version}/${file}`, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  }
  const payload = Buffer.from(JSON.stringify({ schema: 1, protocolVersion: 1, version, extensionVersion: version, assets }));
  const envelope = { payload: payload.toString('base64'), signature: crypto.sign(null, payload, key).toString('base64') };
  fs.writeFileSync(path.join(directory, 'webagentmate-update.json'), JSON.stringify(envelope) + '\n');
}
function verifyRelease(directory, publicKey = require('./update-key.json')) {
  const envelope = JSON.parse(fs.readFileSync(path.join(directory, 'webagentmate-update.json')));
  const bytes = Buffer.from(envelope.payload, 'base64');
  if (!crypto.verify(null, bytes, crypto.createPublicKey({ key: Buffer.from(publicKey.spki, 'base64'), type: 'spki', format: 'der' }), Buffer.from(envelope.signature, 'base64'))) throw new Error('Invalid update release signature');
  const manifest = JSON.parse(bytes);
  const version = require('../../public/manifest.json').version;
  if (manifest.schema !== 1 || manifest.protocolVersion !== 1 || manifest.version !== version || manifest.extensionVersion !== version) throw new Error('Incompatible update manifest');
  for (const [target, name] of [['darwin-x64', 'macos-x64'], ['darwin-arm64', 'macos-arm64'], ['win32-x64', 'windows-x64'], ['linux-x64', 'linux-x64']]) {
    const file = `webagentmate-bridge-${name}.zip`, asset = manifest.assets[target];
    const archive = fs.readFileSync(path.join(directory, file));
    if (asset?.url !== `https://github.com/wintc23/web-agent-mate/releases/download/v${version}/${file}` || asset.size !== archive.length || asset.sha256 !== crypto.createHash('sha256').update(archive).digest('hex')) throw new Error('Update manifest does not match release assets');
  }
}
module.exports = { signRelease, verifyRelease };
if (require.main === module) {
  if (!process.env.WAM_UPDATE_SIGNING_KEY) throw new Error('Configure WAM_UPDATE_SIGNING_KEY before publication');
  signRelease(process.argv[2] || 'artifacts', process.env.WAM_UPDATE_SIGNING_KEY);
}
