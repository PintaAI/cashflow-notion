import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { prisma } from "@/lib/db";
import type { IOType } from "@/lib/db";
import { ok, toolError, getManagementId, getUserId, toIdrAmount } from "@/lib/mcp/tools/utils";

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

        if (fromManagementId === toManagementId) {
          throw new Error("Destination wallet must be different from the current one");
        }

        const membership = await prisma.managementMember.findFirst({
          where: { userId, managementId: toManagementId },
        });
        if (!membership) throw new Error("You are not a member of the destination wallet");

        const idrAmount = await toIdrAmount(amount);

        const [fromManagement, toManagement] = await Promise.all([
          prisma.management.findUnique({ where: { id: fromManagementId }, select: { name: true } }),
          prisma.management.findUnique({ where: { id: toManagementId }, select: { name: true } }),
        ]);
        if (!fromManagement || !toManagement) throw new Error("Wallet not found");

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

        const [fromEntry, toEntry] = await prisma.$transaction([
          prisma.entry.create({
            data: {
              managementId: fromManagementId,
              name: fromName,
              nominal: idrAmount,
              categoryId: fromCategoryId,
              date: today,
              io: "Expenses",
              createdById: userId,
            },
            include: { category: true },
          }),
          prisma.entry.create({
            data: {
              managementId: toManagementId,
              name: toName,
              nominal: idrAmount,
              categoryId: toCategoryId,
              date: today,
              io: "Income",
              createdById: userId,
            },
            include: { category: true },
          }),
        ]);

        return ok(
          `Transferred ${idrAmount} IDR from ${fromManagement.name} to ${toManagement.name}.`,
          {
            fromEntry: { id: fromEntry.id, name: fromEntry.name, nominal: fromEntry.nominal, io: fromEntry.io, date: fromEntry.date, managementName: fromManagement.name },
            toEntry: { id: toEntry.id, name: toEntry.name, nominal: toEntry.nominal, io: toEntry.io, date: toEntry.date, managementName: toManagement.name },
          },
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
