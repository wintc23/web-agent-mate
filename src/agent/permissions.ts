import type { PermissionMode, UserRequest } from "./protocol";

export function autoAllows(mode: PermissionMode | undefined, request: Pick<UserRequest, "kind">): boolean {
  return mode === "auto" && request.kind === "approval";
}
