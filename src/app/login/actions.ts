"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, expectedToken, safeEqual, sha256Hex } from "@/lib/auth-token";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function signIn(
  _prev: { error?: string } | undefined,
  form: FormData,
): Promise<{ error?: string }> {
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");

  const expected = await expectedToken();
  if (!expected) return { error: "This site has not been configured yet." };

  const secret = process.env.AUTH_SECRET!;
  const candidate = await sha256Hex(`${password}:${secret}`);
  if (!safeEqual(candidate, expected)) {
    return { error: "That password is not right." };
  }

  (await cookies()).set(SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });

  // Only ever redirect within this app, never to an attacker-supplied host.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
