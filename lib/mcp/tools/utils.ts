import { AsyncLocalStorage } from "node:async_hooks";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "@/lib/db";
import { getAllRates } from "@/lib/exchange-rates";
import { convertFromIdr, convertToIdr } from "@/lib/currency";

interface MCPContext {
  managementId: string;
  userId: string;
}

export interface UserCurrencyContext {
  currency: string;
  rate: number;
}

export const managementContext = new AsyncLocalStorage<MCPContext>();

export function ok(message: string, data?: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: data === undefined ? message : `${message}\n\n${JSON.stringify(data, null, 2)}` }],
    ...(data === undefined ? {} : { structuredContent: { data } }),
  };
}

export function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function getManagementId(): string {
  const ctx = managementContext.getStore();
  if (!ctx) {
    console.error("MCP: No management context available - managementId not set. Context may have been lost through async boundaries.");
    throw new Error("No management context");
  }
  return ctx.managementId;
}

export function getUserId(): string {
  const ctx = managementContext.getStore();
  if (!ctx) throw new Error("No management context");
  return ctx.userId;
}

export async function getUserCurrencyContext(): Promise<UserCurrencyContext> {
  const userId = getUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currency: true },
  });
  const currency = user?.currency ?? "IDR";
  if (currency === "IDR") return { currency, rate: 1 };

  const rates = await getAllRates();
  return { currency, rate: rates[currency] ?? 1 };
}

export async function toIdrAmount(nominal: number, ctx?: UserCurrencyContext): Promise<number> {
  const { currency, rate } = ctx ?? await getUserCurrencyContext();
  if (currency === "IDR") return nominal;
  return Math.round(convertToIdr(nominal, currency, rate));
}

export function fromIdrAmount(amount: number, ctx: UserCurrencyContext): number {
  if (ctx.currency === "IDR") return amount;
  return convertFromIdr(amount, ctx.currency, ctx.rate);
}
