import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { fetchActivityOverview, fetchAnalytics } from "@/lib/analytics";
import { getSummary } from "@/lib/db";
import { isValidDate, ok, toolError } from "@/lib/mcp/tools/utils";

export function registerAnalyticsTools(server: McpServer) {
  server.registerTool(
    "get_summary",
    {
      title: "Get Cashflow Summary",
      description: "Get total income, expenses, balance, and recent weekly/monthly breakdowns.",
    },
    async () => {
      try {
        const summary = await getSummary();
        return ok("Fetched cashflow summary.", summary);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_analytics",
    {
      title: "Get Cashflow Analytics",
      description: "Get detailed cashflow analytics by category, month, and day with optional filters.",
      inputSchema: {
        io: z.enum(["Income", "Expenses"]).optional(),
        category: z.string().trim().min(1).optional(),
        startDate: z.string().optional().describe("Inclusive start date in YYYY-MM-DD format"),
        endDate: z.string().optional().describe("Exclusive end date in YYYY-MM-DD format"),
      },
    },
    async ({ io, category, startDate, endDate }) => {
      try {
        if (startDate && !isValidDate(startDate)) throw new Error("startDate must be a valid YYYY-MM-DD value");
        if (endDate && !isValidDate(endDate)) throw new Error("endDate must be a valid YYYY-MM-DD value");

        const analytics = await fetchAnalytics({ io, category, startDate, endDate });
        return ok("Fetched cashflow analytics.", analytics);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "get_activity_overview",
    {
      title: "Get Cashflow Activity Overview",
      description: "Get entry activity by day, including total active days and current streak.",
      inputSchema: { daysBack: z.number().int().min(1).max(730).optional() },
    },
    async ({ daysBack = 182 }) => {
      try {
        const overview = await fetchActivityOverview(daysBack);
        return ok("Fetched cashflow activity overview.", overview);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
