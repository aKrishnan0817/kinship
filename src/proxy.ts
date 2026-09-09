import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, expectedToken, gateDisabled, safeEqual } from "@/lib/auth-token";

function noIndex(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // robots.txt stays reachable, otherwise its disallow rule can never be read.
  if (gateDisabled() || pathname.startsWith("/login") || pathname === "/robots.txt") {
    return noIndex(NextResponse.next());
  }

  const expected = await expectedToken();
  if (!expected) {
    return new NextResponse(
      "This site is not configured yet. Set FAMILY_PASSWORD and AUTH_SECRET.",
      { status: 503, headers: { "X-Robots-Tag": "noindex, nofollow" } },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && safeEqual(token, expected)) {
    return noIndex(NextResponse.next());
  }

  // fetch() callers need JSON they can parse, not a redirect to an HTML page.
  if (pathname.startsWith("/api/")) {
    return noIndex(NextResponse.json({ error: "Not signed in" }, { status: 401 }));
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return noIndex(NextResponse.redirect(login));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
