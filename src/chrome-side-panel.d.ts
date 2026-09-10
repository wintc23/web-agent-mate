// The pinned Chrome types predate sidePanel.open(), available since Chrome 116.
declare namespace chrome.sidePanel {
  function open(options: { windowId: number } | { tabId: number }): Promise<void>;
}
