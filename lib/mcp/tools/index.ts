import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAnalyticsTools } from "@/lib/mcp/tools/analytics";
import { registerBudgetTools } from "@/lib/mcp/tools/budgets";
import { registerCategoryTools } from "@/lib/mcp/tools/categories";
import { registerEntryTools } from "@/lib/mcp/tools/entries";
import { registerTransferTools } from "@/lib/mcp/tools/transfer";
import { registerUserTools } from "@/lib/mcp/tools/user";

export function registerCashflowTools(server: McpServer) {
  registerUserTools(server);
  registerEntryTools(server);
  registerAnalyticsTools(server);
  registerCategoryTools(server);
  registerBudgetTools(server);
  registerTransferTools(server);
}
