import { cloneElement, useState, type ReactElement } from "react";
import { Alert, Button, Dropdown, Modal, Space } from "antd";
import { DownOutlined, ReloadOutlined } from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SupportedLanguage } from "./locales";
import { bridgeInstallGuides } from "./bridge-install-guide";
import { useBridgeDownload } from "./use-bridge-download";
import { workspaceText } from "./workspace-i18n";
import { BRIDGE_PACKAGES, type BridgePackage } from "./agent/bridge-download";

type Text = (key: Parameters<typeof workspaceText>[1]) => string;
export function BridgeSetup({ s, language, onCheck }: { s: Text; language: SupportedLanguage; onCheck?: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { target, downloading, downloadState, startDownload } = useBridgeDownload();
  return <><Space wrap className="ws-connector-actions">
    <Dropdown.Button className="ws-connector-download" icon={<DownOutlined />} trigger={["click"]} loading={downloading} disabled={downloading}
      buttonsRender={([left, right]) => [left, cloneElement(right as ReactElement, { "aria-label": s("installerPlatform") })]}
      menu={{ selectedKeys: target ? [target] : [], items: Object.entries(BRIDGE_PACKAGES).map(([key, item]) => ({ key, label: item.label })), onClick: ({ key }) => void startDownload(key as BridgePackage) }}
      onClick={() => void startDownload()}>
      {s("downloadBridge")}
    </Dropdown.Button>
    <Button onClick={() => setGuideOpen(true)}>{s("bridgeGuide")}</Button>
    {onCheck && <Button icon={<ReloadOutlined />} loading={checking} onClick={() => { setChecking(true); void onCheck().finally(() => setChecking(false)); }}>{s("checkBridge")}</Button>}
  </Space>
    {target && <p className="ws-modal-hint">{BRIDGE_PACKAGES[target].label}</p>}
    {downloadState && <Alert showIcon type={downloadState === "downloadStarted" ? "success" : "info"} message={s(downloadState)} />}
    <Modal title={s("bridgeGuide")} open={guideOpen} onCancel={() => setGuideOpen(false)} footer={null} width={600} zIndex={1300} className="ws-modal">
      <div className="ws-markdown ws-install-guide" lang={language.replace("_", "-")}><Markdown remarkPlugins={[remarkGfm]} skipHtml>{bridgeInstallGuides[language]}</Markdown></div>
    </Modal>
  </>;
}
