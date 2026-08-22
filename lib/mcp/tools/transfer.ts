import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { prisma } from "@/lib/db";
import type { IOType } from "@/lib/db";
import { fromIdrAmount, getManagementId, getUserCurrencyContext, getUserId, ok, toIdrAmount, toolError } from "@/lib/mcp/tools/utils";

async function ensureTransferCategory(managementId: string, name: string, io: IOType) {
  const existing = await prisma.category.findFirst({
    where: { managementId, name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const category = await prisma.category.create({
    data: {
      managementId,
      name,
      color: io === "Income" ? "green" : "gray",
      icon: io === "Income" ? "MoneyReceiveIcon" : "MoneySendIcon",
    },
    select: { id: true },
  });
  return category.id;
}

export function registerTransferTools(server: McpServer) {
  server.registerTool(
    "transfer_between_managements",
    {
      title: "Transfer Between Managements (Dompet)",
      description: "Transfer money from the current management to another management. Creates an expense in the source wallet and income in the destination wallet.",
      inputSchema: {
        toManagementId: z.string().min(1).describe("Destination management/wallet ID"),
        amount: z.number().positive().describe("Transfer amount in the user's preferred currency"),
        note: z.string().trim().min(1).optional().describe("Optional note for both entries"),
        date: z.string().optional().describe("Entry date in YYYY-MM-DD format"),
      },
    },
    async ({ toManagementId, amount, note, date }) => {
      try {
        const fromManagementId = getManagementId();
        const userId = getUserId();
        const ctx = await getUserCurrencyContext();

        if (fromManagementId === toManagementId) {
          throw new Error("Destination wallet must be different from the current one");
        }

        const membership = await prisma.managementMember.findFirst({
          where: { userId, managementId: toManagementId },
        });
        if (!membership) throw new Error("You are not a member of the destination wallet");

        const idrAmount = await toIdrAmount(amount);

        const [fromManagement, toManagement] = await Promise.all([
          prisma.management.findUnique({ where: { id: fromManagementId }, select: { name: true, category: true } }),
          prisma.management.findUnique({ where: { id: toManagementId }, select: { name: true, category: true } }),
        ]);
        if (!fromManagement || !toManagement) throw new Error("Wallet not found");
        const isInvestmentTransfer = toManagement.category === "INVESTMENT";

        const today = date ?? (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        })();

        const fromName = note?.trim() || `Transfer to ${toManagement.name}`;
        const toName = note?.trim() || `Transfer from ${fromManagement.name}`;

        const [fromCategoryId, toCategoryId] = await Promise.all([
          ensureTransferCategory(fromManagementId, "Transfer Out", "Expenses"),
          ensureTransferCategory(toManagementId, "Transfer In", "Income"),
        ]);
        const exchangeRateToIdr = ctx.currency === "IDR" ? 1 : 1 / ctx.rate;

        const [fromEntry, toEntry] = await prisma.$transaction([
          prisma.entry.create({
            data: {
              managementId: fromManagementId,
              name: fromName,
              nominal: idrAmount,
              originalNominal: amount,
              originalCurrency: ctx.currency,
              exchangeRateToIdr,
              exchangeRateAt: new Date(),
              categoryId: fromCategoryId,
              date: today,
              io: "Expenses",
              isInvestmentTransfer,
              createdById: userId,
            },
            include: { category: true },
          }),
          prisma.entry.create({
            data: {
              managementId: toManagementId,
              name: toName,
              nominal: idrAmount,
              originalNominal: amount,
              originalCurrency: ctx.currency,
              exchangeRateToIdr,
              exchangeRateAt: new Date(),
              categoryId: toCategoryId,
              date: today,
              io: "Income",
              isInvestmentTransfer,
              createdById: userId,
            },
            include: { category: true },
          }),
        ]);

        return ok(
          `Transferred ${fromIdrAmount(idrAmount, ctx)} ${ctx.currency} from ${fromManagement.name} to ${toManagement.name}.`,
          {
            fromEntry: { id: fromEntry.id, name: fromEntry.name, nominal: fromIdrAmount(fromEntry.nominal, ctx), currency: ctx.currency, io: fromEntry.io, date: fromEntry.date, managementName: fromManagement.name },
            toEntry: { id: toEntry.id, name: toEntry.name, nominal: fromIdrAmount(toEntry.nominal, ctx), currency: ctx.currency, io: toEntry.io, date: toEntry.date, managementName: toManagement.name },
            currency: ctx.currency,
          },
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
