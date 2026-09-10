import { agentPageUrl } from "./page";

export function openFromToolbar(tab: Pick<chrome.tabs.Tab, "url" | "windowId">): Promise<unknown> {
  const page = new URL(chrome.runtime.getURL("sidepanel.html"));
  let current: URL | undefined;
  try { if (tab.url) current = new URL(tab.url); } catch { /* Open the side panel for other pages. */ }
  if (current?.protocol === page.protocol && current.host === page.host && current.pathname === page.pathname && current.searchParams.get("view") === "page") {
    const sessionId = current.searchParams.get("session");
    const url = sessionId ? agentPageUrl(sessionId) : `${page.href}?view=page`;
    return chrome.tabs.create({ url, active: true, windowId: tab.windowId });
  }
  // Call synchronously from the action handler to retain the user gesture.
  return chrome.sidePanel.open({ windowId: tab.windowId });
}
