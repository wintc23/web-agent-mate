import { repairHistory, type QueuedMessage, type Session } from "./protocol";

export const MAX_QUEUED_MESSAGES = 20;
export const MAX_MESSAGE_LENGTH = 50_000;

export function enqueueMessage(session: Session, text: string): QueuedMessage {
  text = text.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) throw new Error("INVALID_MESSAGE_LENGTH");
  const queue = session.queuedMessages ??= [];
  if (queue.length >= MAX_QUEUED_MESSAGES) throw new Error("MESSAGE_QUEUE_FULL");
  const message = { id: crypto.randomUUID(), text, createdAt: Date.now() };
  queue.push(message);
  return message;
}

// Call inside the same transaction that acquires the run lease. A losing window
// must never remove a queued message or append a duplicate user entry.
export function takeQueuedMessage(session: Session, id?: string): QueuedMessage {
  const queue = session.queuedMessages ?? [];
  const index = id ? queue.findIndex(message => message.id === id) : queue.findIndex(message => !message.delivery);
  if (index < 0 || !queue[index]) throw new Error("QUEUED_MESSAGE_NOT_FOUND");
  if (queue[index].delivery === "sending") throw new Error("MESSAGE_DELIVERY_IN_PROGRESS");
  const [message] = queue.splice(index, 1);
  session.entries.push({ id: message.id, kind: "user", text: message.text, status: "completed" });
  if (!session.title) session.title = message.text.replace(/\s+/g, " ").slice(0, 48);
  return message;
}

export function removeQueuedMessage(session: Session, id: string): QueuedMessage {
  const index = session.queuedMessages?.findIndex(message => message.id === id) ?? -1;
  if (index < 0) throw new Error("QUEUED_MESSAGE_NOT_FOUND");
  if (session.queuedMessages![index].delivery === "sending" && session.activeRun) throw new Error("MESSAGE_DELIVERY_IN_PROGRESS");
  return session.queuedMessages!.splice(index, 1)[0];
}

export function preserveInterruptedReply(session: Session): void {
  if (session.config.engine !== "builtin") return;
  session.history = repairHistory(session.history);
  // Streaming text isn't checkpointed until the model finishes its response.
  const last = session.entries.at(-1);
  if (last?.kind === "assistant" && last.status === "running" && last.text &&
      !session.history.some(message => message.role === "assistant" && message.content === last.text)) {
    session.history.push({ role: "assistant", content: last.text });
  }
}
