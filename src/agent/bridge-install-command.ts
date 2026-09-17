export function macBridgeInstallCommand(version: string, extensionId: string): string {
  if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(version) || !/^[a-p]{32}$/.test(extensionId)) throw new Error("Invalid installer version or extension ID");
  return `/bin/bash <<'WEBAGENTMATE_INSTALL'
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo "This installer requires macOS." >&2; exit 1; }
case "$(uname -m)" in
  arm64) wam_arch=arm64 ;;
  x86_64) wam_arch=x64
    if [[ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" == 1 ]]; then wam_arch=arm64; fi ;;
  *) echo "Unsupported Mac architecture." >&2; exit 1 ;;
esac
wam_install_dir="$(mktemp -d)"
trap 'rm -rf "$wam_install_dir"' EXIT
wam_asset="webagentmate-bridge-macos-$wam_arch.zip"
wam_release="https://github.com/wintc23/web-agent-mate/releases/download/v${version}"
curl --fail --location --proto '=https' --tlsv1.2 --output "$wam_install_dir/$wam_asset" "$wam_release/$wam_asset"
curl --fail --location --proto '=https' --tlsv1.2 --output "$wam_install_dir/$wam_asset.sha256" "$wam_release/$wam_asset.sha256"
(cd "$wam_install_dir" && shasum -a 256 -c "$wam_asset.sha256")
ditto -x -k "$wam_install_dir/$wam_asset" "$wam_install_dir/payload"
/bin/bash "$wam_install_dir/payload/install-native-host-macos.sh" '${extensionId}'
WEBAGENTMATE_INSTALL`;
}
