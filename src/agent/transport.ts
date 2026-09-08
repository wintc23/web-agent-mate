// Chrome caps a native host's outbound message at 1 MiB. Keep both directions
// below that cap, including worst-case JSON escaping, without truncating history.
const FRAME_CHARS = 48_000;
const DIRECT_BYTES = 512_000;
export const MAX_RUNTIME_BYTES = 16 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_RUNTIME_BYTES / FRAME_CHARS);
const encoder = new TextEncoder();
interface Chunk { type: "runtime_chunk"; id: string; index: number; total: number; data: string }

export function encodeRuntimeMessage(message: unknown): unknown[] {
  const text = JSON.stringify(message);
  if (typeof text !== "string") throw new Error("INVALID_RUNTIME_MESSAGE");
  const bytes = encoder.encode(text).byteLength;
  if (bytes > MAX_RUNTIME_BYTES) throw new Error("RUNTIME_MESSAGE_TOO_LARGE");
  if (bytes <= DIRECT_BYTES) return [message];
  const id = crypto.randomUUID();
  const total = Math.ceil(text.length / FRAME_CHARS);
  return Array.from({ length: total }, (_, index): Chunk => ({ type: "runtime_chunk", id, index, total, data: text.slice(index * FRAME_CHARS, (index + 1) * FRAME_CHARS) }));
}

export class RuntimeDecoder {
  private transfer?: { id: string; total: number; parts: string[]; chars: number; started: number };
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private readonly now = () => Date.now(), private readonly onTimeout?: (error: Error) => void, private readonly timeoutMs = 30_000) {}
  dispose(): void { clearTimeout(this.timer); this.transfer = undefined; }
  push(frame: unknown): unknown | undefined {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) throw new Error("INVALID_RUNTIME_MESSAGE");
    const chunk = frame as Partial<Chunk>;
    if (chunk.type !== "runtime_chunk") {
      this.finish();
      return frame;
    }
    if (typeof chunk.id !== "string" || !chunk.id || chunk.id.length > 100 || typeof chunk.data !== "string" || chunk.data.length > FRAME_CHARS ||
        !Number.isInteger(chunk.index) || !Number.isInteger(chunk.total) || chunk.total! < 1 || chunk.total! > MAX_PARTS) throw new Error("INVALID_RUNTIME_CHUNK");
    if (!this.transfer) {
      if (chunk.index !== 0) throw new Error("RUNTIME_CHUNK_OUT_OF_ORDER");
      this.transfer = { id: chunk.id, total: chunk.total!, parts: [], chars: 0, started: this.now() };
      if (this.onTimeout) this.timer = setTimeout(() => { this.dispose(); this.onTimeout!(new Error("RUNTIME_CHUNK_TIMEOUT")); }, this.timeoutMs);
    }
    const transfer = this.transfer;
    if (this.now() - transfer.started > this.timeoutMs) { this.dispose(); throw new Error("RUNTIME_CHUNK_TIMEOUT"); }
    if (chunk.id !== transfer.id || chunk.total !== transfer.total || chunk.index !== transfer.parts.length) throw new Error("RUNTIME_CHUNK_OUT_OF_ORDER");
    transfer.chars += chunk.data.length;
    if (transfer.chars > MAX_RUNTIME_BYTES) throw new Error("RUNTIME_MESSAGE_TOO_LARGE");
    transfer.parts.push(chunk.data);
    if (transfer.parts.length !== transfer.total) return undefined;
    const text = transfer.parts.join("");
    this.dispose();
    if (encoder.encode(text).byteLength > MAX_RUNTIME_BYTES) throw new Error("RUNTIME_MESSAGE_TOO_LARGE");
    const message: unknown = JSON.parse(text);
    if (!message || typeof message !== "object" || Array.isArray(message) || (message as { type?: unknown }).type === "runtime_chunk") throw new Error("INVALID_RUNTIME_MESSAGE");
    return message;
  }
  finish(): void { if (this.transfer) { this.dispose(); throw new Error("RUNTIME_MESSAGE_INCOMPLETE"); } }
}
