export function agentPageUrl(sessionId: string): string {
  const url = new URL(chrome.runtime.getURL("sidepanel.html"));
  url.searchParams.set("view", "page");
  url.searchParams.set("session", sessionId);
  return url.href;
}

export async function openAgentPage(sessionId: string): Promise<void> {
  const url = agentPageUrl(sessionId);
  const existing = (await chrome.tabs.query({})).find(tab => tab.url === url && tab.id !== undefined);
  if (existing) {
    // Focus without reloading: the page may own a running native connection.
    await chrome.tabs.update(existing.id!, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else await chrome.tabs.create({ url, active: true });
}
