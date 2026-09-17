import { cloneElement, useState, type ReactElement } from "react";
import { Alert, Button, Dropdown, Modal, Space, Tabs } from "antd";
import { CheckOutlined, CopyOutlined, DownOutlined, ReloadOutlined } from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SupportedLanguage } from "./locales";
import { bridgeInstallGuides } from "./bridge-install-guide";
import { bridgeInstallMethods } from "./bridge-install-methods-i18n";
import { macBridgeInstallCommand } from "./agent/bridge-install-command";
import { useBridgeDownload } from "./use-bridge-download";
import { workspaceText } from "./workspace-i18n";
import { BRIDGE_PACKAGES, defaultBridgePackage, type BridgePackage, type BridgePlatform } from "./agent/bridge-download";

type Text = (key: Parameters<typeof workspaceText>[1]) => string;
const platforms: Record<BridgePlatform, string> = { macos: "macOS", windows: "Windows", linux: "Linux" };
export function BridgeSetup({ s, language, onCheck }: { s: Text; language: SupportedLanguage; onCheck?: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [macMethod, setMacMethod] = useState("terminal");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed">();
  const { target, system, selectTarget, downloading, downloadState, startDownload } = useBridgeDownload();
  const platform = target ? BRIDGE_PACKAGES[target].platform : system?.os === "win" ? "windows" : system?.os === "linux" ? "linux" : "macos";
  const guide = bridgeInstallGuides[language];
  const methods = bridgeInstallMethods[language];
  const command = macBridgeInstallCommand(chrome.runtime.getManifest().version, chrome.runtime.id);
  const packages = Object.entries(BRIDGE_PACKAGES);
  const changePlatform = (key: string) => {
    const detected = system && defaultBridgePackage(system);
    const selected = detected && BRIDGE_PACKAGES[detected].platform === key ? detected : packages.find(([, item]) => item.platform === key)?.[0] as BridgePackage | undefined;
    if (selected) selectTarget(selected);
  };
  const downloadButton = (forPlatform?: BridgePlatform) => <Dropdown.Button className="ws-connector-download" icon={<DownOutlined />} trigger={["click"]} loading={downloading} disabled={downloading}
      buttonsRender={([left, right]) => [left, cloneElement(right as ReactElement, { "aria-label": s("installerPlatform") })]}
      menu={{ selectedKeys: target ? [target] : [], items: packages.filter(([, item]) => !forPlatform || item.platform === forPlatform).map(([key, item]) => ({ key, label: item.label })), onClick: ({ key }) => void startDownload(key as BridgePackage) }}
      onClick={() => void startDownload()}>
      {s("downloadBridge")}
    </Dropdown.Button>;
  const downloadFeedback = downloadState && <Alert showIcon type={downloadState === "downloadStarted" ? "success" : "info"} message={s(downloadState)} />;
  const markdown = (text: string) => <div className="ws-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml>{text}</Markdown></div>;
  const graphicalGuide = (key: BridgePlatform) => <>
    {markdown(guide.download)}
    <Space wrap className="ws-connector-actions">{downloadButton(key)}</Space>
    {target && <p className="ws-modal-hint">{BRIDGE_PACKAGES[target].label}</p>}
    {downloadFeedback}
    {markdown(guide.platforms[key])}
  </>;
  const terminalGuide = <>
    {markdown(methods.steps)}
    <Button className="ws-install-copy" icon={copyStatus === "copied" ? <CheckOutlined aria-hidden="true" /> : <CopyOutlined aria-hidden="true" />} onClick={async () => {
      try { await navigator.clipboard.writeText(command); setCopyStatus("copied"); }
      catch { setCopyStatus("failed"); }
    }}>{copyStatus === "copied" ? methods.copied : methods.copy}</Button>
    <p className="ws-modal-hint">{methods.detail}</p>
    {copyStatus === "failed" && <Alert type="info" showIcon message={methods.copyFailed} />}
    <details className="ws-install-command" open={copyStatus === "failed" || undefined}>
      <summary>{methods.viewCommand}</summary>
      <pre><code>{command}</code></pre>
    </details>
  </>;
  return <><Space wrap className="ws-connector-actions">
    {downloadButton()}
    <Button onClick={() => setGuideOpen(true)}>{s("bridgeGuide")}</Button>
    {onCheck && <Button icon={<ReloadOutlined />} loading={checking} onClick={() => { setChecking(true); void onCheck().finally(() => setChecking(false)); }}>{s("checkBridge")}</Button>}
  </Space>
    {target && <p className="ws-modal-hint">{BRIDGE_PACKAGES[target].label}</p>}
    {!guideOpen && downloadFeedback}
    <Modal title={s("bridgeGuide")} open={guideOpen} onCancel={() => setGuideOpen(false)} footer={null} width={600} zIndex={1300} className="ws-modal">
      <div className="ws-install-guide" lang={language.replace("_", "-")}>
        <Tabs className="ws-install-platforms" activeKey={platform} onChange={changePlatform} animated={false} destroyOnHidden items={Object.entries(platforms).map(([key, label]) => ({
          key, label, disabled: downloading && key !== platform,
          children: <>
            {key === "macos" ? <Tabs className="ws-install-methods" activeKey={macMethod} onChange={setMacMethod} animated={false} destroyOnHidden items={[
              { key: "terminal", label: methods.terminal, children: terminalGuide },
              { key: "graphical", label: methods.graphical, children: graphicalGuide("macos") }
            ]} /> : graphicalGuide(key as BridgePlatform)}
            {markdown(`${guide.maintenance}\n\n${guide.uninstall[key as BridgePlatform]}`)}
          </>
        }))} />
      </div>
    </Modal>
  </>;
}
