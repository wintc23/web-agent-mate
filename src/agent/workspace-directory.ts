import type { WorkspaceDirectory } from "../messages";

// Like native agents, directory browsing connects from the extension page itself.
// An older or unavailable background router cannot discard this request.
export async function listWorkspaceDirectory(path = "", offset = 0): Promise<WorkspaceDirectory> {
  const id = crypto.randomUUID();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: any;
  try {
    response = await Promise.race([
      chrome.runtime.sendNativeMessage("ai.webagentmate.bridge", { id, protocolVersion: 1, method: "workspace.list", params: { path, offset } }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("WORKSPACE_TIMEOUT")), 10_000); })
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_TIMEOUT") throw error;
    throw new Error("WORKSPACE_BRIDGE_UNAVAILABLE", { cause: error });
  } finally { clearTimeout(timer); }
  if (!response || response.id !== id) throw new Error("WORKSPACE_RESPONSE_INVALID");
  if (!response.ok) throw new Error(response.error?.code || "WORKSPACE_READ_FAILED");
  const result = response.result;
  if (!result || typeof result.path !== "string" || !Array.isArray(result.directories) ||
    !result.directories.every((item: any) => typeof item?.name === "string" && typeof item?.path === "string") ||
    (result.parent != null && typeof result.parent !== "string") ||
    (result.nextOffset != null && (!Number.isInteger(result.nextOffset) || result.nextOffset < 0))) throw new Error("WORKSPACE_RESPONSE_INVALID");
  return result;
}

export function directoryErrorKey(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (/TIMEOUT/.test(code)) return "directoryTimeout";
  if (/METHOD_NOT_FOUND|PROTOCOL_VERSION_UNSUPPORTED/.test(code)) return "directoryUpdate";
  if (/PATH_INVALID|NOT_DIRECTORY|NOT_FOUND/.test(code)) return "directoryInvalid";
  if (/PERMISSION|DENIED/.test(code)) return "directoryDenied";
  if (/BRIDGE_UNAVAILABLE|BACKGROUND_UNAVAILABLE/.test(code)) return "directoryUnavailable";
  return "directoryFailed";
}
