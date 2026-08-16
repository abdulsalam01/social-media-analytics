import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/_next", "/favicon.ico", "/logo.svg"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api/") || pathname === "/" || pathname.startsWith("/dashboard") ||
      pathname.startsWith("/accounts") || pathname.startsWith("/input") ||
      pathname.startsWith("/report") || pathname.startsWith("/settings") ||
      pathname.startsWith("/compare") || pathname.startsWith("/help") ||
      pathname.startsWith("/content") || pathname.startsWith("/scraper")) {
    const hasSession = req.cookies.get("socmed_insight_session");
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
