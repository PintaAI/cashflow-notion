import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import { registerCashflowTools } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    registerCashflowTools(server);
  },
  {
    serverInfo: {
      name: "cashflow-notion",
      version: "0.1.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === "development",
  },
);

async function verifyToken(_request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const expectedToken = process.env.MCP_API_KEY;

  if (!expectedToken || !bearerToken || bearerToken !== expectedToken) {
    return undefined;
  }

  return {
    token: bearerToken,
    clientId: "cashflow-mcp-client",
    scopes: ["cashflow:read", "cashflow:write"],
  };
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["cashflow:read", "cashflow:write"],
});

export { authHandler as DELETE, authHandler as GET, authHandler as POST };
