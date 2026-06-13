import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/db";
import { managementContext } from "@/lib/mcp/tools/utils";
import { verifyAccessToken, isOAuthAccessToken } from "@/lib/oauth/server";

import { registerCashflowTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const rawMcpHandler = createMcpHandler(
  (server) => {
    registerCashflowTools(server);
  },
  {
    serverInfo: {
      name: "cashflow",
      version: "0.1.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

const handler = (req: Request) => {
  const authInfo = (req as unknown as Record<string, unknown>).auth as AuthInfo | undefined;
  const managementId = authInfo?.extra?.managementId as string | undefined;
  const userId = (authInfo?.extra?.userId as string) || authInfo?.clientId;

  if (managementId && userId) {
    return managementContext.run({ managementId, userId }, () => rawMcpHandler(req));
  }
  return rawMcpHandler(req);
};

async function resolveActiveManagementId(userId: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { activeManagementId: true },
  });

  if (user?.activeManagementId) {
    const membership = await prisma.managementMember.findFirst({
      where: { userId, managementId: user.activeManagementId },
    });
    if (membership) return membership.managementId;
  }

  const membership = await prisma.managementMember.findFirst({
    where: { userId },
  });
  return membership?.managementId;
}

async function verifyToken(
  request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  let userId: string | undefined;
  let scopes: string[] = [];

  if (bearerToken) {
    if (isOAuthAccessToken(bearerToken)) {
      const tokenInfo = await verifyAccessToken(bearerToken);
      if (tokenInfo) {
        userId = tokenInfo.userId;
        scopes = tokenInfo.scopes;
      }
    } else {
      const user = await prisma.user.findUnique({
        where: { mcpApiKey: bearerToken },
      });
      if (user) {
        userId = user.id;
        scopes = ["cashflow:read", "cashflow:write"];
      }
    }
  }

  if (!userId) {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("api_key");
    if (queryToken) {
      const user = await prisma.user.findUnique({
        where: { mcpApiKey: queryToken },
      });
      if (user) {
        userId = user.id;
        scopes = ["cashflow:read", "cashflow:write"];
      }
    }
  }

  if (!userId) return undefined;

  const managementId = await resolveActiveManagementId(userId);
  if (!managementId) return undefined;

  return {
    token: bearerToken || "",
    clientId: userId,
    scopes,
    extra: { managementId, userId },
  };
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["cashflow:read", "cashflow:write"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

async function resolveManagementId(req: Request): Promise<{ managementId: string; userId: string } | undefined> {
  const url = new URL(req.url);
  const queryManagementId = url.searchParams.get("management_id");
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  let userId: string | undefined;

  if (bearerToken) {
    if (isOAuthAccessToken(bearerToken)) {
      const tokenInfo = await verifyAccessToken(bearerToken);
      if (tokenInfo) userId = tokenInfo.userId;
    } else {
      const user = await prisma.user.findUnique({
        where: { mcpApiKey: bearerToken },
      });
      if (user) userId = user.id;
    }
  }

  if (!userId) {
    const queryToken = url.searchParams.get("api_key");
    if (queryToken) {
      const user = await prisma.user.findUnique({
        where: { mcpApiKey: queryToken },
      });
      if (user) userId = user.id;
    }
  }

  if (!userId) return undefined;

  if (queryManagementId) {
    const membership = await prisma.managementMember.findFirst({
      where: { userId, managementId: queryManagementId },
    });
    if (membership) return { managementId: membership.managementId, userId };
  }

  const activeId = await resolveActiveManagementId(userId);
  if (!activeId) return undefined;
  return { managementId: activeId, userId };
}

async function scopedHandler(req: Request) {
  const ctx = await resolveManagementId(req);
  if (ctx) {
    return managementContext.run(ctx, () => authHandler(req));
  }
  console.warn("MCP: resolveManagementId returned no context, falling back to auth handler");
  return authHandler(req);
}

export { scopedHandler as DELETE, scopedHandler as GET, scopedHandler as POST };
