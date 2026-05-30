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

  const membership = await prisma.managementMember.findFirst({
    where: { userId },
  });
  if (!membership) return undefined;

  managementContext.enterWith(membership.managementId);

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

export { authHandler as DELETE, authHandler as GET, authHandler as POST };
