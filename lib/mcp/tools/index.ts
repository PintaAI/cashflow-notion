import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAnalyticsTools } from "@/lib/mcp/tools/analytics";
import { registerCategoryTools } from "@/lib/mcp/tools/categories";
import { registerEntryTools } from "@/lib/mcp/tools/entries";
import { registerQuickFillTools } from "@/lib/mcp/tools/quick-fills";

export function registerCashflowTools(server: McpServer) {
  registerAnalyticsTools(server);
  registerEntryTools(server);
  registerCategoryTools(server);
  registerQuickFillTools(server);
}
