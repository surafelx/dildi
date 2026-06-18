/**
 * In-memory bot sessions. The derived AES key lives ONLY here, in the bot
 * process memory, for the session TTL — never persisted, mirroring the web
 * app's "key in the session cookie" model. On expiry the user must /login again.
 */
const TTL_MS = Number(process.env.BOT_SESSION_TTL_SECONDS ?? 900) * 1000;

export type Pending =
  | { kind: "await_email" }
  | { kind: "await_password"; email: string }
  | { kind: "await_reg_email" }
  | { kind: "await_reg_password"; email: string }
  | { kind: "await_journal" }
  | { kind: "await_mood" }
  | { kind: "await_chat" };

export interface BotSession {
  userId: string;
  key: Buffer;
  expiresAt: number;
  pending?: Pending;
}

const sessions = new Map<number, BotSession>(); // keyed by telegram chat id

export function getSession(chatId: number): BotSession | null {
  const s = sessions.get(chatId);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    sessions.delete(chatId);
    return null;
  }
  return s;
}

export function startSession(chatId: number, userId: string, key: Buffer) {
  sessions.set(chatId, { userId, key, expiresAt: Date.now() + TTL_MS });
}

export function touch(chatId: number) {
  const s = sessions.get(chatId);
  if (s) s.expiresAt = Date.now() + TTL_MS;
}

export function endSession(chatId: number) {
  sessions.delete(chatId);
}

/** Pending state is allowed even before login (the login flow itself uses it). */
const pendingMap = new Map<number, Pending | undefined>();

export function setPending(chatId: number, p: Pending | undefined) {
  pendingMap.set(chatId, p);
}
export function getPending(chatId: number): Pending | undefined {
  return pendingMap.get(chatId);
}

/**
 * The single "anchor" message per chat that the whole UI lives in. We edit it
 * in place as the user navigates, instead of sending new messages.
 */
const anchorMap = new Map<number, number>();

export function getAnchor(chatId: number): number | undefined {
  return anchorMap.get(chatId);
}
export function setAnchor(chatId: number, messageId: number) {
  anchorMap.set(chatId, messageId);
}
export function clearAnchor(chatId: number) {
  anchorMap.delete(chatId);
}
