import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerEssentialTools } from "@/lib/mcp/tools/essential";

export function registerCashflowTools(server: McpServer) {
  registerEssentialTools(server);
}
