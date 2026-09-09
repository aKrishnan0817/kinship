import { cookies } from "next/headers";
import { SESSION_COOKIE, expectedToken, gateDisabled, safeEqual } from "./auth-token";

/** Server-side check for route handlers and server actions. */
export async function requireSession(): Promise<boolean> {
  if (gateDisabled()) return true;
  const expected = await expectedToken();
  if (!expected) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return Boolean(token && safeEqual(token, expected));
}
