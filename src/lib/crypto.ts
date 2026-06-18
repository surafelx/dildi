import crypto from "crypto";

/**
 * Field-level encryption for Dildi.
 *
 * THREAT MODEL & HONEST BOUNDARIES
 * --------------------------------
 * - Therapy notes, journal bodies, chat messages, and activity notes are
 *   encrypted with AES-256-GCM before they touch the database. A stolen DB
 *   dump is useless without the per-user key.
 * - The key is derived from the user's password via PBKDF2 (per-user salt +
 *   a server-side pepper). The KEY IS NEVER PERSISTED. It is derived at login
 *   and held only in the server-side session for that session's lifetime.
 * - This is "encrypted-at-rest, the DB can't be read offline" — NOT literal
 *   end-to-end zero knowledge. Server-side AI features (chat, weekly
 *   narrative) require transient plaintext, so during an authenticated
 *   request the running process can see decrypted content. That is the
 *   deliberate trade-off that makes the AI features possible. For true E2EE
 *   you would move derivation + encryption into the browser and drop server
 *   AI. See README "Security model".
 */

const PBKDF2_ITERATIONS = 210_000; // OWASP-recommended floor for PBKDF2-HMAC-SHA256
const KEY_LEN = 32; // AES-256
const ALGO = "aes-256-gcm";

const PEPPER = process.env.ENCRYPTION_PEPPER ?? "";

/** Create a fresh random salt (base64) for a new user. */
export function newSalt(): string {
  return crypto.randomBytes(16).toString("base64");
}

/** Derive the 32-byte AES key from password + per-user salt + server pepper. */
export function deriveKey(password: string, saltB64: string): Buffer {
  const salt = Buffer.concat([
    Buffer.from(saltB64, "base64"),
    Buffer.from(PEPPER, "utf8"),
  ]);
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

/** Encrypt a UTF-8 string. Output: iv:authTag:ciphertext (all base64). */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** Decrypt a payload produced by encrypt(). Throws on tamper/wrong key. */
export function decrypt(payload: string, key: Buffer): string {
  const [ivB64, tagB64, ctB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed ciphertext");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

const VERIFIER_CONST = "mindbridge:key-verifier:v1";

/** Produce a verifier so we can later confirm a derived key is correct. */
export function makeVerifier(key: Buffer): string {
  return encrypt(VERIFIER_CONST, key);
}

/** Returns true if `key` correctly decrypts the stored verifier. */
export function checkVerifier(verifier: string, key: Buffer): boolean {
  try {
    return decrypt(verifier, key) === VERIFIER_CONST;
  } catch {
    return false;
  }
}

/**
 * The derived key travels in the encrypted NextAuth JWT (httpOnly cookie) as
 * base64. Helpers to (de)serialize it at the request boundary.
 */
export function keyToString(key: Buffer): string {
  return key.toString("base64");
}
export function keyFromString(s: string): Buffer {
  return Buffer.from(s, "base64");
}
