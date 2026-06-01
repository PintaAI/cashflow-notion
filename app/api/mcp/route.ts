import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/db";
import { managementContext } from "@/lib/mcp/tools/utils";
import { verifyAccessToken, isOAuthAccessToken } from "@/lib/oauth/server";

import { registerCashflowTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
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
  };
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["cashflow:read", "cashflow:write"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

async function resolveManagementId(req: Request): Promise<string | undefined> {
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
    if (membership) return membership.managementId;
  }

  return resolveActiveManagementId(userId);
}

async function scopedHandler(req: Request) {
  const managementId = await resolveManagementId(req);
  if (managementId) {
    return managementContext.run(managementId, () => authHandler(req));
  }
  return authHandler(req);
}

export { scopedHandler as DELETE, scopedHandler as GET, scopedHandler as POST };
