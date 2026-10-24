import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin/constants";

/**
 * Cheap first bounce for the admin: no session cookie, no admin page. This only checks the
 * cookie exists; the (panel) layout and requireAdmin() in every loader and action verify it.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/login" || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (pathname.startsWith("/admin/api/")) {
    return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
