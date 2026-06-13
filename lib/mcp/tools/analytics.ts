import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { fetchActivityOverview, fetchAnalytics, type AnalyticsData } from "@/lib/analytics";
import type { CashflowSummary } from "@/lib/db";
import { getSummary } from "@/lib/db";
import { convertFromIdr } from "@/lib/currency";
import { isValidDate, ok, toolError, getManagementId, getUserCurrencyContext } from "@/lib/mcp/tools/utils";

function convertSummary(summary: CashflowSummary, ctx: { currency: string; rate: number }): CashflowSummary {
  if (ctx.rate === 1) return summary;

  const conv = (v: number) => convertFromIdr(v, ctx.currency, ctx.rate);

  return {
    ...summary,
    totalIncome: conv(summary.totalIncome),
    totalExpenses: conv(summary.totalExpenses),
    balance: conv(summary.balance),
    byCategory: Object.fromEntries(
      Object.entries(summary.byCategory).map(([k, v]) => [k, conv(v)]),
    ),
    byIO: Object.fromEntries(
      Object.entries(summary.byIO).map(([k, v]) => [k, conv(v)]),
    ),
    currentWeek: {
      ...summary.currentWeek,
      income: conv(summary.currentWeek.income),
      expenses: conv(summary.currentWeek.expenses),
    },
    currentMonth: {
      ...summary.currentMonth,
      income: conv(summary.currentMonth.income),
      expenses: conv(summary.currentMonth.expenses),
    },
    topExpenseCategories: summary.topExpenseCategories.map((c) => ({
      ...c,
      total: conv(c.total),
    })),
    weeklyBreakdown: summary.weeklyBreakdown.map((w) => ({
      ...w,
      income: conv(w.income),
      expenses: conv(w.expenses),
    })),
  };
}

function convertAnalytics(data: AnalyticsData, ctx: { currency: string; rate: number }): AnalyticsData {
  if (ctx.rate === 1) return data;

  const conv = (v: number) => convertFromIdr(v, ctx.currency, ctx.rate);

  return {
    ...data,
    summary: {
      ...data.summary,
      totalIncome: conv(data.summary.totalIncome),
      totalExpenses: conv(data.summary.totalExpenses),
      balance: conv(data.summary.balance),
    },
    byCategory: data.byCategory.map((c) => ({
      ...c,
      total: conv(c.total),
    })),
    byMonth: data.byMonth.map((m) => ({
      ...m,
      income: conv(m.income),
      expenses: conv(m.expenses),
      net: conv(m.net),
    })),
    byDay: data.byDay.map((d) => ({
      ...d,
      income: conv(d.income),
      expenses: conv(d.expenses),
      net: conv(d.net),
    })),
  };
}

export function registerAnalyticsTools(server: McpServer) {
  server.registerTool(
    "get_summary",
    {
      title: "Get Cashflow Summary",
      description: "Get total income, expenses, balance, and recent weekly/monthly breakdowns.",
    },
    async () => {
      try {
        const ctx = await getUserCurrencyContext();
        const summary = await getSummary(getManagementId());
        return ok("Fetched cashflow summary.", convertSummary(summary, ctx));
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

        const ctx = await getUserCurrencyContext();
        const analytics = await fetchAnalytics({ io, category, startDate, endDate }, getManagementId());
        return ok("Fetched cashflow analytics.", convertAnalytics(analytics, ctx));
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
        const overview = await fetchActivityOverview(daysBack, getManagementId());
        return ok("Fetched cashflow activity overview.", overview);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
