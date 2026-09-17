export const BRIDGE_PACKAGES = {
  "macos-arm64": { platform: "macos", label: "macOS · Apple Silicon", file: "webagentmate-bridge-macos-arm64.dmg" },
  "macos-x64": { platform: "macos", label: "macOS · Intel", file: "webagentmate-bridge-macos-x64.dmg" },
  "windows-x64": { platform: "windows", label: "Windows · x64", file: "webagentmate-bridge-windows-x64.exe" },
  "linux-deb": { platform: "linux", label: "Linux · Ubuntu / Debian (.deb)", file: "webagentmate-bridge-linux-x64.deb" },
  "linux-rpm": { platform: "linux", label: "Linux · Fedora (.rpm)", file: "webagentmate-bridge-linux-x64.rpm" }
} as const;
export type BridgePackage = keyof typeof BRIDGE_PACKAGES;
export type BridgePlatform = typeof BRIDGE_PACKAGES[BridgePackage]["platform"];
export function defaultBridgePackage(platform: Pick<chrome.runtime.PlatformInfo, "os" | "arch">): BridgePackage | undefined {
  if (platform.os === "mac") return platform.arch === "arm" || platform.arch === "arm64" ? "macos-arm64" : platform.arch === "x86-64" ? "macos-x64" : undefined;
  if (platform.os === "win" && platform.arch === "x86-64") return "windows-x64";
  if (platform.os === "linux" && platform.arch === "x86-64") return "linux-deb";
  return undefined;
}
export async function bridgeAsset(version: string, target: BridgePackage, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ url: string; filename: string }> {
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(version) || !Object.hasOwn(BRIDGE_PACKAGES, target)) throw new Error("BRIDGE_DOWNLOAD_UNAVAILABLE");
  const response = await fetcher(`https://api.github.com/repos/wintc23/web-agent-mate/releases/tags/v${version}`, { signal, credentials: "omit", headers: { Accept: "application/vnd.github+json" } });
  if (response.status === 404) throw new Error("BRIDGE_DOWNLOAD_UNAVAILABLE");
  if (!response.ok) throw new Error("BRIDGE_DOWNLOAD_FAILED");
  const release = await response.json();
  const filename = BRIDGE_PACKAGES[target].file;
  const url = `https://github.com/wintc23/web-agent-mate/releases/download/v${version}/${filename}`;
  if (release.draft || release.tag_name !== `v${version}` || !Array.isArray(release.assets) || !release.assets.some((asset: any) => asset.name === filename && asset.state === "uploaded" && asset.size > 0 && asset.browser_download_url === url)) throw new Error("BRIDGE_DOWNLOAD_UNAVAILABLE");
  return { url, filename };
}
export async function downloadBridge(target: BridgePackage, signal?: AbortSignal): Promise<number> {
  const asset = await bridgeAsset(chrome.runtime.getManifest().version, target, signal);
  signal?.throwIfAborted();
  return chrome.downloads.download({ ...asset, conflictAction: "uniquify", saveAs: false });
}
