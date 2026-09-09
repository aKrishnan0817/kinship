/**
 * Shared-password gate. Deliberately minimal: one password for the whole family,
 * exchanged for a cookie holding a hash they can't forge without the server secret.
 * This keeps the tree off the open web — it is not per-person authentication.
 *
 * Edge-safe: uses only Web Crypto, so `proxy.ts` can import it.
 */

export const SESSION_COOKIE = "ft_session";

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value a correctly-authenticated visitor should be holding. */
export async function expectedToken(): Promise<string | null> {
  const password = process.env.FAMILY_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) return null;
  return sha256Hex(`${password}:${secret}`);
}

/** Length-independent, content constant-time comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * With no password configured we allow local development through, but fail
 * closed in production so a missing env var can never silently expose the tree.
 */
export function gateDisabled(): boolean {
  return !process.env.FAMILY_PASSWORD && process.env.NODE_ENV !== "production";
}
