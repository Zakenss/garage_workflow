import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, parseSession, getRoleHome, canAccess } from "@/lib/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/session"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = parseSession(sessionRaw);

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(getRoleHome(session.role), request.url));
  }

  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(getRoleHome(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
