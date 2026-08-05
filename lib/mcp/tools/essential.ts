import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createEntry, deleteEntry, getSummary, prisma, updateEntry } from "@/lib/db";
import { dayPresetBlockPayloadSchema, dayPresetSchedulePayloadSchema, habitLogPayloadSchema, habitPayloadSchema, timeBoxPayloadSchema } from "@/lib/lifeflow/contract";
import { resolveLifeFlowDay } from "@/lib/lifeflow/resolve-day";
import { registerLifeFlowTools } from "./lifeflow";
import { fromIdrAmount, getManagementId, getUserCurrencyContext, getUserId, isValidDate, ok, requireMcpScope, toIdrAmount, toolError } from "./utils";

const readAnnotations = { readOnlyHint: true, openWorldHint: false };
const writeAnnotations = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

export function registerEssentialTools(server: McpServer) {
  server.registerTool("cashflow_overview", {
    title: "Cashflow Overview",
    description: "Summarize cashflow and list recent entries, optionally filtered by date or type.",
    annotations: readAnnotations,
    inputSchema: {
      date: z.string().optional(),
      io: z.enum(["Income", "Expenses"]).optional(),
      limit: z.number().int().min(1).max(50).default(10),
    },
  }, async ({ date, io, limit }) => {
    try {
      requireMcpScope("cashflow:read");
      if (date && !isValidDate(date)) throw new Error("date must be YYYY-MM-DD");
      const managementId = getManagementId();
      const [summary, entries, currency] = await Promise.all([
        getSummary(managementId),
        prisma.entry.findMany({
          where: { managementId, date, io }, include: { category: true },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: limit,
        }),
        getUserCurrencyContext(),
      ]);
      return ok("Cashflow overview ready.", {
        currency: currency.currency,
        summary: {
          income: fromIdrAmount(summary.totalIncome, currency),
          expenses: fromIdrAmount(summary.totalExpenses, currency),
          balance: fromIdrAmount(summary.balance, currency),
        },
        entries: entries.map((entry) => ({
          id: entry.id, name: entry.name, amount: entry.originalNominal ?? fromIdrAmount(entry.nominal, currency),
          io: entry.io, date: entry.date, category: entry.category?.name ?? null,
        })),
      });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("cashflow_record", {
    title: "Manage Cashflow Record",
    description: "Create, update, or delete one income or expense record.",
    annotations: writeAnnotations,
    inputSchema: {
      action: z.enum(["create", "update", "delete"]), id: z.string().optional(),
      name: z.string().trim().min(1).optional(), amount: z.number().positive().optional(),
      io: z.enum(["Income", "Expenses"]).optional(), date: z.string().optional(), category: z.string().optional(),
    },
  }, async ({ action, id, name, amount, io, date, category }) => {
    try {
      requireMcpScope("cashflow:write");
      const managementId = getManagementId();
      if (date && !isValidDate(date)) throw new Error("date must be YYYY-MM-DD");
      if (action === "delete") {
        if (!id) throw new Error("id is required");
        await deleteEntry(id, managementId);
        return ok("Cashflow record deleted.", { id });
      }
      const currency = await getUserCurrencyContext();
      const nominal = amount === undefined ? undefined : await toIdrAmount(amount, currency);
      if (action === "create") {
        if (!name || !amount || !io || !date || !category) throw new Error("name, amount, io, date, and category are required");
        const entry = await createEntry({ name, nominal: nominal!, originalNominal: amount, originalCurrency: currency.currency,
          exchangeRateToIdr: currency.currency === "IDR" ? 1 : 1 / currency.rate, exchangeRateAt: new Date(),
          io, date, category, managementId, userId: getUserId() });
        return ok("Cashflow record created.", entry);
      }
      if (!id) throw new Error("id is required");
      const entry = await updateEntry(id, { name, nominal, io, date, category, managementId,
        ...(amount === undefined ? {} : { originalNominal: amount, originalCurrency: currency.currency,
          exchangeRateToIdr: currency.currency === "IDR" ? 1 : 1 / currency.rate, exchangeRateAt: new Date() }) });
      return ok("Cashflow record updated.", entry);
    } catch (error) { return toolError(error); }
  });

  server.registerTool("lifeflow_today", {
    title: "LifeFlow Day",
    description: "Read habits and the effective schedule for one local date. Returns occurrence id, series_id, and block_id needed by lifeflow_habit and lifeflow_schedule; recurring storage details are hidden.",
    annotations: readAnnotations,
    inputSchema: { date: z.string().describe("Local calendar date in YYYY-MM-DD format.") },
  }, async ({ date }) => {
    try {
      requireMcpScope("lifeflow:read");
      if (!isValidDate(date)) throw new Error("date must be YYYY-MM-DD");
      const entities = await prisma.lifeFlowEntity.findMany({
        where: { managementId: getManagementId(), deletedAt: null },
      });
      const parseKind = <T>(kind: string, schema: z.ZodType<T>) => entities
        .filter((item) => item.kind === kind)
        .map((item) => schema.parse(item.payload));
      const habits = parseKind("habit", habitPayloadSchema);
      const logs = parseKind("habit_log", habitLogPayloadSchema).filter((log) => log.date === date);
      const schedule = resolveLifeFlowDay(
        date,
        parseKind("time_box", timeBoxPayloadSchema),
        parseKind("day_preset_block", dayPresetBlockPayloadSchema),
        parseKind("day_preset_schedule", dayPresetSchedulePayloadSchema),
      );
      const seriesBySchedule = new Map(parseKind("day_preset_schedule", dayPresetSchedulePayloadSchema).map((item) => [item.id, item.preset_id]));
      return ok("LifeFlow day ready.", {
        date,
        habits: habits.map((habit) => ({ ...habit, weekdays: JSON.parse(habit.weekdays_json), weekdays_json: undefined })),
        logs,
        schedule: schedule.map((box) => ({
          id: box.id, date: box.date, title: box.title, start_time: box.start_time, end_time: box.end_time,
          color: box.color, break_durations: JSON.parse(box.break_durations_json), habit_id: box.habit_id,
          completed: box.completed === 1, virtual: box.virtual === true,
          series_id: box.preset_schedule_id ? seriesBySchedule.get(box.preset_schedule_id) ?? null : null,
          block_id: box.preset_block_id,
        })),
      });
    } catch (error) { return toolError(error); }
  });
  registerLifeFlowTools(server, writeAnnotations);
}
