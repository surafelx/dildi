/**
 * Client-side API helper. Talks to the standalone Dildi API (Express on Render)
 * via NEXT_PUBLIC_API_URL, attaching the JWT as a Bearer token.
 *
 * SECURITY NOTE: the JWT carries the derived field-encryption key, stored in
 * localStorage for the SPA model. This is more XSS-exposed than the previous
 * httpOnly-cookie approach — keep the app XSS-clean, and for higher assurance
 * move the token to an httpOnly cookie set by the API.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "dildi_token";

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

/** fetch wrapper: prefixes the API base + adds auth + JSON headers. */
export async function api(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}
