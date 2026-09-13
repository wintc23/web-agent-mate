import { useEffect, useRef, useState } from "react";
import { Button, Progress, Space, Switch } from "antd";
import type { SupportedLanguage } from "./locales";
import type { BackgroundRequest, BackgroundResponse, BridgeUpdateStatus } from "./messages";
import { updateText } from "./bridge-updates-i18n";

export function BridgeUpdates({ language, supported, version }: { language: SupportedLanguage; supported: boolean; version?: string }) {
  const text = updateText(language);
  const [status, setStatus] = useState<BridgeUpdateStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const element = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);
  function accept(value: BridgeUpdateStatus) {
    setStatus(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
  }
  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    const refresh = async () => {
      // Only this visible settings card refreshes. Conversation state and model
      // menus are not involved, and background tabs do not poll the native host.
      if (!supported || stopped || pending.current || document.hidden || !element.current?.getClientRects().length) return;
      pending.current = true;
      const requestGeneration = generation.current;
      try {
        const result: BackgroundResponse = await chrome.runtime.sendMessage({ type: "bridge:update:status" });
        if (!stopped && requestGeneration === generation.current && result.ok) { accept(result.data as BridgeUpdateStatus); setError(false); }
      } catch { /* A brief disconnect while switching versions is expected. */ }
      finally { pending.current = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false; stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [supported]);
  async function act(request: BackgroundRequest) {
    generation.current++;
    setBusy(true); setError(false);
    try {
      const result: BackgroundResponse = await chrome.runtime.sendMessage(request);
      if (!result.ok) throw new Error(result.error);
      if (mounted.current) accept(result.data as BridgeUpdateStatus);
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setBusy(false); }
  }
  const inProgress = status && ["checking", "downloading", "waiting_idle", "applying"].includes(status.phase);
  return <div ref={element} className="ws-bridge-updates">
    <Space wrap><strong>{text.title}</strong>{supported && <Switch aria-label={text.title} checked={status?.enabled ?? true} disabled={!status || busy} onChange={enabled => void act({ type: "bridge:update:configure", enabled })} />}</Space>
    <p className="ws-settings-hint">{supported ? text.hint : text.legacy}</p>
    <p className="ws-settings-hint">{text.version}: {status?.version ?? version}</p>
    {supported && <><p role="status">{error ? text.error : status?.enabled === false ? text.paused : text[status?.phase ?? "idle"]}</p>
      {status?.phase === "downloading" && <Progress percent={status.progress ?? 0} size="small" aria-label={text.downloading} />}
      <Button loading={busy} disabled={!status?.enabled || !!inProgress} onClick={() => void act({ type: "bridge:update:check" })}>{text.check}</Button>
    </>}
  </div>;
}
