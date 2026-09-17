import { useEffect, useRef, useState } from "react";
import { defaultBridgePackage, downloadBridge, type BridgePackage } from "./agent/bridge-download";

type DownloadState = "downloadStarted" | "downloadUnavailable" | "downloadFailed";

export function useBridgeDownload() {
  const [target, setTarget] = useState<BridgePackage>();
  const [system, setSystem] = useState<chrome.runtime.PlatformInfo>();
  const [downloading, setDownloading] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>();
  const controller = useRef<AbortController>();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    void (async () => {
      try {
        const info = await chrome.runtime.getPlatformInfo();
        if (live) {
          setSystem(info);
          setTarget(selected => selected ?? defaultBridgePackage(info));
        }
      } catch { /* The click handler can retry platform detection. */ }
    })();
    return () => { live = false; mounted.current = false; controller.current?.abort(); };
  }, []);
  const selectTarget = (selected: BridgePackage) => {
    setTarget(selected);
    setDownloadState(undefined);
  };
  const startDownload = async (selected = target): Promise<DownloadState | undefined> => {
    if (controller.current) return;
    const request = new AbortController(); controller.current = request;
    setDownloading(true); setDownloadState(undefined);
    const timer = setTimeout(() => request.abort(), 20_000);
    let result: DownloadState;
    try {
      selected ??= defaultBridgePackage(await chrome.runtime.getPlatformInfo());
      request.signal.throwIfAborted();
      if (!selected) throw new Error("BRIDGE_DOWNLOAD_UNAVAILABLE");
      if (mounted.current) setTarget(selected);
      await downloadBridge(selected, request.signal);
      result = "downloadStarted";
    } catch (error) {
      result = error instanceof Error && error.message === "BRIDGE_DOWNLOAD_UNAVAILABLE" ? "downloadUnavailable" : "downloadFailed";
    } finally {
      clearTimeout(timer); controller.current = undefined;
      if (mounted.current) setDownloading(false);
    }
    if (!mounted.current) return;
    setDownloadState(result);
    return result;
  };
  return { target, system, selectTarget, downloading, downloadState, startDownload };
}
