// Real packaged launcher, private Node, OS locks, signed downloads and rollback.
// Runs on each release target without modifying the logged-in user's registration.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { zipSync } = require('fflate');
const { install } = require('./setup.cjs');
const { check, extract } = require('./updater.cjs');
const run = promisify(execFile);
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message, timeout = 45_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await pause(100); }
  throw new Error(message);
}
async function files(directory, prefix = '') {
  const entries = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name, file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(entries, await files(file, `${name}/`));
    else { assert(entry.isFile(), 'No symlinks in update fixtures'); entries[name] = new Uint8Array(await fs.readFile(file)); }
  }
  return entries;
}
(async () => {
  const payload = path.resolve(process.argv[2] || 'build/installer-payload');
  const archive = process.argv[3] ? await fs.readFile(path.resolve(process.argv[3])) : undefined;
  const meta = await read(path.join(payload, 'bundle.json'));
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'wam-upgrade space-'));
  const root = path.join(temporary, 'installation');
  const target = { root, manifests: [path.join(temporary, 'manifest.json')] };
  const env = { ...process.env, HOME: temporary, XDG_DATA_HOME: temporary, XDG_CONFIG_HOME: temporary, LOCALAPPDATA: temporary };
  const executable = process.platform === 'win32' ? 'webagentmate-bridge.exe' : 'webagentmate-bridge';
  const pair = crypto.generateKeyPairSync('ed25519');
  const publicKey = { algorithm: 'ed25519', spki: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
  let holder, updating;
  async function hold(method = "bridge.hello", params = {}) {
    const registered = await read(target.manifests[0]);
    holder = spawn(registered.path, [`chrome-extension://${meta.extensionId}/`], { env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    const reply = new Promise((resolve, reject) => {
      let buffer = Buffer.alloc(0);
      const timeout = setTimeout(() => reject(new Error('Launcher did not respond')), 15_000);
      holder.once('error', error => { clearTimeout(timeout); reject(error); });
      holder.stdout.on('data', bytes => {
        buffer = Buffer.concat([buffer, bytes]);
        if (buffer.length > 4 && buffer.length >= buffer.readUInt32LE(0) + 4) {
          clearTimeout(timeout); resolve(JSON.parse(buffer.subarray(4, 4 + buffer.readUInt32LE(0))));
        }
      });
    });
    const body = Buffer.from(JSON.stringify({ id: 'lease', protocolVersion: 1, method, params }));
    const header = Buffer.alloc(4); header.writeUInt32LE(body.length);
    holder.stdin.write(Buffer.concat([header, body]));
    const response = await reply;
    assert.equal(response.ok, true);
    if (method === "bridge.hello") assert.equal(response.result.autoUpdate, true);
  }
  async function release(force = false) {
    if (!holder) return;
    const child = holder; holder = undefined;
    const done = new Promise(resolve => child.once('exit', resolve));
    child.stdin.end();
    if (force) {
      if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
      else child.kill();
    }
    await done;
  }
  async function signedArchive(broken = false) {
    const contents = archive ? extract(archive) : await files(payload);
    contents['update-key.json'] = Buffer.from(JSON.stringify(publicKey));
    if (broken) contents['runtime/agent.mjs'] = Buffer.from('throw new Error("health failure fixture");');
    const bytes = archive && !broken ? archive : Buffer.from(zipSync(contents, { level: 1 }));
    const platform = { darwin: 'macos', win32: 'windows', linux: 'linux' }[meta.platform];
    const data = Buffer.from(JSON.stringify({ schema: 1, protocolVersion: 1, version: meta.version, extensionVersion: meta.version, assets: { [`${meta.platform}-${meta.arch}`]: { url: `https://github.com/wintc23/web-agent-mate/releases/download/v${meta.version}/webagentmate-bridge-${platform}-${meta.arch}.zip`, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') } } }));
    return { bytes, manifest: { payload: data.toString('base64'), signature: crypto.sign(null, data, pair.privateKey).toString('base64') } };
  }
  try {
    if (process.platform === 'linux') {
      await run(path.join(payload, 'webagentmate-launcher'), ['--health-check'], { env, timeout: 45_000 });
      const userRoot = path.join(temporary, 'webagentmate');
      const userActive = await read(path.join(userRoot, 'active.json'));
      assert(userActive.current.startsWith('versions/'));
      const userManifest = await read(path.join(temporary, 'google-chrome/NativeMessagingHosts/ai.webagentmate.bridge.json'));
      assert.equal(userManifest.path, path.join(userRoot, 'launcher/webagentmate-launcher'));
      console.log('Linux seed bootstrapped an unprivileged per-user installation.');
    }
    const source = path.join(temporary, 'old-package');
    await fs.cp(payload, source, { recursive: true });
    // Reuse the real binary with an older package version to test the upgrade
    // transition. Candidate health must still report its actual compiled version.
    await fs.writeFile(path.join(source, 'bundle.json'), JSON.stringify({ ...meta, version: '0.0.1' }));
    await fs.writeFile(path.join(source, 'update-key.json'), JSON.stringify(publicKey));
    const installed = await install(source, { locations: target, exec: () => {} });
    await fs.writeFile(path.join(root, 'user-data.txt'), 'preserve');
    const before = await read(path.join(root, 'active.json'));
    const workerFile = path.join(installed, 'runtime/updater.cjs');
    const workerCode = await fs.readFile(workerFile);
    const marker = path.join(root, 'worker-count.txt'), finishWorker = path.join(root, 'finish-worker');
    await fs.writeFile(workerFile, `const fs = require('node:fs'); fs.appendFileSync(${JSON.stringify(marker)}, 'worker\\n'); const timer = setInterval(() => { if (fs.existsSync(${JSON.stringify(finishWorker)})) { clearInterval(timer); } }, 50); setTimeout(() => process.exit(2), 8000).unref();`);
    const firstWorker = run(path.join(installed, executable), ['--update-worker', meta.version, 'force'], { env, timeout: 10_000 });
    try {
      await until(() => fs.access(marker).then(() => true, () => false), 'First worker did not start', 5000);
      await run(path.join(installed, executable), ['--update-worker', meta.version, 'force'], { env, timeout: 5000 });
      assert.equal((await fs.readFile(marker, 'utf8')).trim().split('\n').length, 1, 'Concurrent checks must not start a second worker');
    } finally {
      await fs.writeFile(finishWorker, 'finish'); await firstWorker;
      await fs.writeFile(workerFile, workerCode);
    }
    console.log('Concurrent update requests share one native worker.');
    const good = await signedArchive();
    await hold();
    const fetcher = async url => url.endsWith('webagentmate-update.json') ? Response.json(good.manifest) : new Response(good.bytes);
    // Download through the real updater, then the real native executable owns
    // the exclusive apply lock and executes the packaged updater bundle.
    updating = check(root, installed, meta.version, true, { fetch: fetcher, onError: error => console.error("Download/check failure:", error) });
    await until(async () => { const state = await read(path.join(root, 'updates/status.json')).catch(() => ({})); if (['error', 'rolled_back', 'updated'].includes(state.phase)) throw new Error(`Unexpected update state before releasing lease: ${JSON.stringify(state)}`); return state.phase === 'waiting_idle'; }, 'Update never became ready');
    await pause(600);
    assert.deepEqual(await read(path.join(root, 'active.json')), before, 'Active native ports must prevent switching versions');
    await release();
    await updating;
    assert.equal((await read(path.join(root, 'updates/status.json'))).phase, 'updated');
    const current = await read(path.join(root, 'active.json'));
    assert.equal(current.previous, before.current);
    assert.equal(current.probation, false);
    const registered = await read(target.manifests[0]);
    // Exercise the launcher, not just the candidate binary.
    const health = JSON.parse((await run(registered.path, ['--health-check'], { env, timeout: 45_000 })).stdout);
    assert.equal(health.version, meta.version);
    assert.equal(health.runtimeV2, true);
    assert.equal(await fs.readFile(path.join(root, 'user-data.txt'), 'utf8'), 'preserve');
    console.log('Signed download + actual private runtime + idle-only activation passed.');

    // The background worker must survive the initiating native port closing.
    await fs.rm(path.join(root, 'updates/status.json'));
    await hold('bridge.update.check', { extensionVersion: meta.version, force: true });
    await release(true);
    await until(async () => (await read(path.join(root, 'updates/status.json')).catch(() => ({}))).phase === 'current', 'Detached updater did not complete after native port closed');
    assert.equal((await read(path.join(root, 'updates/status.json'))).phase, 'current');

    // Return to the fixture old installation and attempt a validly signed but
    // unhealthy runtime. The healthy current package must remain recoverable.
    await fs.writeFile(path.join(root, 'active.json'), JSON.stringify(before));
    const bad = await signedArchive(true);
    await check(root, installed, meta.version, true, { fetch: async url => url.endsWith('webagentmate-update.json') ? Response.json(bad.manifest) : new Response(bad.bytes) });
    assert.deepEqual(await read(path.join(root, 'active.json')), before);
    assert.equal((await read(path.join(root, 'updates/status.json'))).phase, 'rolled_back');
    console.log('Unhealthy signed package rolled back without replacing the working installation.');

    // Simulate an updater killed between pointer activation and acknowledgement.
    await fs.writeFile(path.join(root, 'active.json'), JSON.stringify({ ...current, probation: true, targetVersion: meta.version }));
    await run(registered.path, ['--health-check'], { env, timeout: 45_000 });
    assert.equal((await read(path.join(root, 'active.json'))).current, before.current);
    assert.equal((await read(path.join(root, 'updates/status.json'))).phase, 'rolled_back');
    assert.equal(await fs.readFile(path.join(root, 'user-data.txt'), 'utf8'), 'preserve');
    console.log('Interrupted activation recovered through the real launcher; user data preserved.');
  } finally {
    await release();
    if (updating) await updating.catch(() => {});
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
