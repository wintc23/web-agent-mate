import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_PACKAGES, bridgeAsset, defaultBridgePackage, downloadBridge } from "../src/agent/bridge-download";

const assetURL = (filename: string) => `https://github.com/wintc23/web-agent-mate/releases/download/v0.6.0/${filename}`;
const release = () => ({ tag_name: "v0.6.0", draft: false, assets: Object.values(BRIDGE_PACKAGES).map(item => ({ name: item.file, state: "uploaded", size: 100, browser_download_url: assetURL(item.file) })) });

test("detects both Mac processor types and supported Windows/Linux packages", () => {
  assert.equal(defaultBridgePackage({ os: "mac", arch: "arm64" }), "macos-arm64");
  assert.equal(defaultBridgePackage({ os: "mac", arch: "arm" }), "macos-arm64");
  assert.equal(defaultBridgePackage({ os: "mac", arch: "x86-64" }), "macos-x64");
  assert.equal(defaultBridgePackage({ os: "win", arch: "x86-64" }), "windows-x64");
  assert.equal(defaultBridgePackage({ os: "linux", arch: "x86-64" }), "linux-deb");
  assert.equal(defaultBridgePackage({ os: "linux", arch: "arm64" }), undefined);
  assert.equal(defaultBridgePackage({ os: "cros", arch: "x86-64" }), undefined);
});
test("only downloads installers from the matching public release and exact repository", async () => {
  for (const target of Object.keys(BRIDGE_PACKAGES) as Array<keyof typeof BRIDGE_PACKAGES>) {
    const result = await bridgeAsset("0.6.0", target, undefined, (async (url, options) => {
      assert.equal(url, "https://api.github.com/repos/wintc23/web-agent-mate/releases/tags/v0.6.0");
      assert.equal(options?.credentials, "omit");
      return Response.json(release());
    }) as typeof fetch);
    assert.equal(result.url, assetURL(BRIDGE_PACKAGES[target].file));
  }
  for (const data of [{ ...release(), draft: true }, { ...release(), tag_name: "v0.2.2" }, { ...release(), assets: [] }, { ...release(), assets: [{ ...release().assets[0], browser_download_url: "https://example.com/installer.dmg" }] }]) {
    await assert.rejects(bridgeAsset("0.6.0", "macos-arm64", undefined, (async () => Response.json(data)) as typeof fetch), /BRIDGE_DOWNLOAD_UNAVAILABLE/);
  }
  await assert.rejects(bridgeAsset("0.6.0", "macos-arm64", undefined, (async () => new Response("", { status: 404 })) as typeof fetch), /BRIDGE_DOWNLOAD_UNAVAILABLE/);
  await assert.rejects(bridgeAsset("0.6.0", "macos-arm64", undefined, (async () => new Response("", { status: 403 })) as typeof fetch), /BRIDGE_DOWNLOAD_FAILED/);
});
test("a user download invokes Chrome downloads without navigating a page, and cancellation prevents it", async t => {
  const previous = globalThis.chrome;
  const calls: unknown[] = [];
  (globalThis as any).chrome = { runtime: { getManifest: () => ({ version: "0.6.0" }) }, downloads: { download: async (options: unknown) => { calls.push(options); return 7; } }, tabs: { create: () => { throw new Error("Must not open a page"); } } };
  t.after(() => { (globalThis as any).chrome = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json(release()));
  assert.equal(await downloadBridge("windows-x64"), 7);
  assert.deepEqual(calls, [{ url: assetURL(BRIDGE_PACKAGES["windows-x64"].file), filename: BRIDGE_PACKAGES["windows-x64"].file, conflictAction: "uniquify", saveAs: false }]);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(downloadBridge("linux-deb", controller.signal));
  assert.equal(calls.length, 1);
});
