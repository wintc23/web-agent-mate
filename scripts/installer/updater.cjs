// Bundled separately for the private Node runtime, never executed in Chrome.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const { unzipSync } = require('fflate');
const { validatePayload, atomicWrite } = require('./setup.cjs');
const run = promisify(execFile);
const REPO = 'https://github.com/wintc23/web-agent-mate/releases/download';
const MAX_ZIP = 256 * 1024 * 1024;
const MAX_EXPANDED = 512 * 1024 * 1024;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const phases = new Set(['checking', 'downloading', 'waiting_idle', 'applying']);
function fail(code) { throw new Error(code); }
function version(value) { return typeof value === 'string' && /^(0|[1-9]\d{0,7})\.(0|[1-9]\d{0,7})\.(0|[1-9]\d{0,7})$/.test(value); }
function compare(a, b) {
  if (!version(a) || !version(b)) fail('UPDATE_VERSION_INVALID');
  const av = a.split('.').map(Number), bv = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1;
  return 0;
}
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const write = (file, value) => atomicWrite(file, JSON.stringify(value) + '\n');
async function enabled(root) {
  try { return (await read(path.join(root, 'updates/settings.json'))).enabled === true; }
  catch (error) { return error.code === 'ENOENT'; }
}
async function status(root, state) { await write(path.join(root, 'updates/status.json'), { ...state, updatedAt: Date.now() }); }
function safePayload(root, relative) {
  if (typeof relative !== 'string' || !/^versions\/[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(relative)) fail('UPDATE_STATE_INVALID');
  return path.join(root, relative);
}
function verifyManifest(envelope, publicKey, target, current) {
  if (!envelope || typeof envelope.payload !== 'string' || envelope.payload.length > 120_000 || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.payload) || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature)) fail('UPDATE_SIGNATURE_INVALID');
  const bytes = Buffer.from(envelope.payload, 'base64');
  const key = crypto.createPublicKey({ key: Buffer.from(publicKey.spki, 'base64'), format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'ed25519' || !crypto.verify(null, bytes, key, Buffer.from(envelope.signature, 'base64'))) fail('UPDATE_SIGNATURE_INVALID');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.schema !== 1 || manifest.protocolVersion !== 1 || !version(target) || manifest.extensionVersion !== target || manifest.version !== target || compare(manifest.version, current.version) <= 0) fail('UPDATE_INCOMPATIBLE');
  const asset = manifest.assets?.[`${current.platform}-${current.arch}`];
  const platform = { darwin: 'macos', win32: 'windows', linux: 'linux' }[current.platform];
  const url = `${REPO}/v${target}/webagentmate-bridge-${platform}-${current.arch}.zip`;
  if (!asset || asset.url !== url || !/^[0-9a-f]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_ZIP) fail('UPDATE_ASSET_INVALID');
  return { manifest, asset };
}
function extract(bytes) {
  let total = 0, entries = 0;
  const names = new Set();
  return unzipSync(bytes, { filter(file) {
    const name = file.name;
    // Reject absolute paths, drive letters, traversal, Windows aliases/ADS,
    // duplicate entries and case collisions before decompressing anything.
    if (!name || name.includes('\\') || name.startsWith('/') || /[\x00-\x1f:]/.test(name) || name.split('/').filter(Boolean).some(part => part === '..' || part === '.' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) fail('UPDATE_ARCHIVE_INVALID');
    const normalized = name.replace(/\/$/, '').toLowerCase();
    if (names.has(normalized) || ++entries > 2000) fail('UPDATE_ARCHIVE_INVALID');
    names.add(normalized);
    total += file.originalSize;
    if (!Number.isSafeInteger(file.originalSize) || file.originalSize < 0 || total > MAX_EXPANDED) fail('UPDATE_ARCHIVE_TOO_LARGE');
    return !name.endsWith('/');
  } });
}
async function unpack(bytes, destination) {
  const files = extract(bytes);
  await fs.mkdir(destination, { recursive: false, mode: 0o700 });
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(destination, name);
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    // All archive entries become regular files; archive symlinks are never followed.
    await fs.writeFile(file, contents, { flag: 'wx', mode: /^(webagentmate-(bridge|launcher)|runtime\/node\/bin\/node)$/.test(name) ? 0o755 : 0o644 });
  }
}
async function download(url, destination, asset, progress, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(300_000), redirect: 'follow' });
  if (!response.ok || !response.body || response.url && !response.url.startsWith('https://')) fail('UPDATE_DOWNLOAD_FAILED');
  const hash = crypto.createHash('sha256');
  let received = 0, percent = -1;
  const file = await fs.open(destination, 'wx', 0o600);
  try {
    for await (const bytes of response.body) {
      received += bytes.length;
      if (received > asset.size || received > MAX_ZIP) fail('UPDATE_SIZE_MISMATCH');
      hash.update(bytes);
      await file.writeFile(bytes);
      const next = Math.floor(received / asset.size * 100);
      if (next !== percent) { percent = next; await progress(percent); }
    }
  } finally { await file.close(); }
  if (received !== asset.size || hash.digest('hex') !== asset.sha256) fail('UPDATE_CHECKSUM_MISMATCH');
}
async function fetchManifest(target, fetcher = fetch) {
  const response = await fetcher(`${REPO}/v${target}/webagentmate-update.json`, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return undefined;
  if (!response.ok || !response.body || response.url && !response.url.startsWith('https://')) fail('UPDATE_CHECK_FAILED');
  const chunks = []; let size = 0;
  for await (const bytes of response.body) {
    size += bytes.length;
    if (size > 128_000) fail('UPDATE_MANIFEST_TOO_LARGE');
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function health(candidate, expectedVersion) {
  const binary = path.join(candidate, process.platform === 'win32' ? 'webagentmate-bridge.exe' : 'webagentmate-bridge');
  const result = JSON.parse(execFileSync(binary, ['--health-check'], { timeout: 30_000, maxBuffer: 16_384, windowsHide: true, encoding: 'utf8', input: '' }));
  if (result.version !== expectedVersion || result.protocolVersion !== 1 || !result.runtimeV2) fail('UPDATE_HEALTH_FAILED');
}
async function recover(root) {
  const activeFile = path.join(root, 'active.json'), active = await read(activeFile);
  if (!active.probation) return;
  safePayload(root, active.previous);
  await write(activeFile, { current: active.previous, previous: active.current, probation: false });
  await status(root, { phase: 'rolled_back', targetVersion: active.targetVersion, failedVersion: active.targetVersion, error: 'UPDATE_INTERRUPTED' });
}
async function apply(root, source, stageName, target, dependencies = {}) {
  if (!/^stage-[0-9a-f-]{36}$/.test(stageName || '')) fail('UPDATE_STATE_INVALID');
  const stage = path.join(root, 'updates', stageName);
  const activeFile = path.join(root, 'active.json');
  const before = await read(activeFile);
  // A delayed worker may outlive another completed installation.
  if (path.resolve(safePayload(root, before.current)) !== path.resolve(source)) return;
  if (!await enabled(root)) { await status(root, { phase: 'idle' }); return; }
  const meta = await validatePayload(source, process.platform);
  const { manifest, asset } = verifyManifest(await read(path.join(stage, 'manifest.json')), await read(path.join(source, 'update-key.json')), target, meta);
  const bytes = await fs.readFile(path.join(stage, 'package.zip'));
  if (bytes.length !== asset.size || crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) fail('UPDATE_CHECKSUM_MISMATCH');
  const relative = `versions/${manifest.version}-${crypto.randomUUID()}`;
  const candidate = safePayload(root, relative);
  await status(root, { phase: 'applying', targetVersion: target });
  try {
    await unpack(bytes, candidate);
    const next = await validatePayload(candidate, meta.platform);
    if (next.version !== target || next.arch !== meta.arch || next.extensionId !== meta.extensionId || next.autoUpdateProtocol !== 1) fail('UPDATE_INCOMPATIBLE');
    (dependencies.health || health)(candidate, target);
    if (!await enabled(root)) { await fs.rm(candidate, { recursive: true, force: true }); await status(root, { phase: 'idle' }); return; }
    await write(activeFile, { current: relative, previous: before.current, probation: true, targetVersion: target });
    (dependencies.health || health)(candidate, target);
    await write(activeFile, { current: relative, previous: before.current, probation: false });
    await status(root, { phase: 'updated', targetVersion: target, lastChecked: Date.now() });
    // Retain current + previous, including the worker's own executable until it exits.
    for (const entry of await fs.readdir(path.join(root, 'versions'))) {
      const name = `versions/${entry}`;
      if (name === relative || name === before.current) continue;
      if (/^versions\/\d+\.\d+\.\d+-[0-9a-f-]{36}$/.test(name)) await fs.rm(path.join(root, name), { recursive: true, force: true }).catch(() => {});
    }
  } catch (error) {
    await write(activeFile, before);
    await status(root, { phase: 'rolled_back', targetVersion: target, failedVersion: target, error: 'UPDATE_HEALTH_FAILED' });
    await fs.rm(candidate, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
async function check(root, source, target, force = false, dependencies = {}) {
  let stage;
  try {
    if (!await enabled(root)) return;
    const previous = await read(path.join(root, 'updates/status.json')).catch(() => ({}));
    if (!force && previous.failedVersion === target) return; // avoid a rollback/reinstall loop
    if (!force && previous.targetVersion === target && Date.now() - (previous.lastChecked || 0) < CHECK_INTERVAL && !phases.has(previous.phase)) return;
    const active = await read(path.join(root, 'active.json'));
    if (path.resolve(safePayload(root, active.current)) !== path.resolve(source)) return;
    for (const name of await fs.readdir(path.join(root, 'updates')).catch(() => [])) {
      if (!/^stage-[0-9a-f-]{36}$/.test(name)) continue;
      const directory = path.join(root, 'updates', name);
      if (Date.now() - (await fs.stat(directory)).mtimeMs > 24 * 60 * 60 * 1000) await fs.rm(directory, { recursive: true, force: true });
    }
    const current = await validatePayload(source, process.platform);
    const common = { targetVersion: target, lastChecked: Date.now() };
    if (compare(target, current.version) <= 0) { await status(root, { ...common, phase: 'current' }); return; }
    await status(root, { ...common, phase: 'checking' });
    const envelope = await fetchManifest(target, dependencies.fetch);
    if (!envelope) { await status(root, { ...common, phase: 'unavailable' }); return; }
    const { asset } = verifyManifest(envelope, await read(path.join(source, 'update-key.json')), target, current);
    stage = path.join(root, 'updates', `stage-${crypto.randomUUID()}`);
    await fs.mkdir(stage, { mode: 0o700 });
    await write(path.join(stage, 'manifest.json'), envelope);
    await download(asset.url, path.join(stage, 'package.zip'), asset, async progress => {
      if (!await enabled(root)) fail('UPDATE_DISABLED');
      await status(root, { ...common, phase: 'downloading', progress });
    }, dependencies.fetch);
    await status(root, { ...common, phase: 'waiting_idle' });
    const binary = path.join(source, process.platform === 'win32' ? 'webagentmate-bridge.exe' : 'webagentmate-bridge');
    await (dependencies.activate || (async () => run(binary, ['--apply-update', path.basename(stage), target], { windowsHide: true, maxBuffer: 16_384 })))();
  } catch (error) {
    dependencies.onError?.(error);
    const state = await read(path.join(root, 'updates/status.json')).catch(() => ({}));
    if (state.phase !== 'rolled_back') await status(root, { phase: error.message === 'UPDATE_DISABLED' ? 'idle' : 'error', targetVersion: target, lastChecked: Date.now(), error: /^UPDATE_[A-Z_]+$/.test(error.message) ? error.message : 'UPDATE_FAILED' });
  } finally { if (stage) await fs.rm(stage, { recursive: true, force: true }).catch(() => {}); }
}
module.exports = { verifyManifest, extract, unpack, download, fetchManifest, compare, apply, check, recover, health };
if (require.main === module) (async () => {
  const [action, root, source, arg, mode] = process.argv.slice(2);
  if (action === 'check') await check(root, source, arg, mode === 'force');
  else if (action === 'apply') await apply(root, source, arg, mode);
  else if (action === 'recover') await recover(root);
  else fail('UPDATE_ACTION_INVALID');
})().catch(() => { process.exitCode = 1; });
