import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type SessionWithManagement = {
  user?: {
    id?: string;
    activeManagementId?: string | null;
  };
};

async function getRedirectManagementId(session: SessionWithManagement) {
  const userId = session.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeManagementId: true },
  });
  if (user?.activeManagementId) {
    const membership = await prisma.managementMember.findFirst({
      where: { userId, managementId: user.activeManagementId },
      select: { managementId: true },
    });
    if (membership) return membership.managementId;
  }

  const membership = await prisma.managementMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { managementId: true },
  });
  if (!membership) return null;

  await prisma.user.update({
    where: { id: userId },
    data: { activeManagementId: membership.managementId },
  });

  return membership.managementId;
}

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
      let safeRedirect = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
      if (safeRedirect === "/") {
        const managementId = await getRedirectManagementId(session);
        if (managementId) safeRedirect = `/dompet/${managementId}`;
      }
      return NextResponse.redirect(new URL(safeRedirect, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(authUrl);
  }

  if (pathname === "/") {
    const managementId = await getRedirectManagementId(session);
    if (managementId) {
      return NextResponse.redirect(new URL(`/dompet/${managementId}`, request.url));
    }
  }

  if (pathname.startsWith("/m/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/m\//, "/dompet/");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw\\.js|workbox-.*\\.js|worker-.*\\.js|.*\\.(?:png|json|js|ico|svg)$).*)"],
};
