import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isSkippedPath =
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/oauth") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/worker-");

  if (isSkippedPath) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (pathname === "/auth") {
    if (session) {
      const redirectTo = request.nextUrl.searchParams.get("redirect");
      const safeRedirect = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
      return NextResponse.redirect(new URL(safeRedirect, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|workbox-.*\\.js|worker-.*\\.js|.*\\.(?:png|json|js|ico|svg)$).*)"],
};
