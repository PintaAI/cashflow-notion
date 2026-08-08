import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { itemPayloadSchema, itemOccurrenceSnapshotSchema, recurrenceSignature, weekdaySchema } from "@/lib/lifeflow/contract";
import { recurrenceApplies } from "@/lib/lifeflow/resolve-day";
import { getUserId, ok, requireMcpScope, toolError } from "./utils";

const key = (userId: string, kind: string, entityId: string) => ({ userId_kind_entityId: { userId, kind, entityId } });
const json = (value: unknown) => value as Prisma.InputJsonValue;
const recurrence = z.object({ frequency: z.enum(["daily", "weekly", "monthly", "yearly"]), interval: z.number().int().positive(), weekdays: z.array(weekdaySchema), ends_on: z.string().nullable() }).strict();
const itemFields = {
  id: z.string().optional(), kind: z.enum(["habit", "event"]).optional(), name: z.string().trim().min(1).max(200).optional(), color: z.string().trim().min(1).max(40).optional(),
  starts_on: z.string().optional(), start_time: z.string().nullable().optional(), end_time: z.string().nullable().optional(),
  break_durations: z.array(z.number().int().positive().multipleOf(5)).optional(), recurrence: recurrence.nullable().optional(), reset_history: z.boolean().optional(),
};

async function liveItem(userId: string, id: string) {
  const entity = await prisma.lifeFlowEntity.findUnique({ where: key(userId, "item", id) });
  if (!entity || entity.deletedAt) throw new Error(`item ${id} not found`);
  return { entity, item: itemPayloadSchema.parse(entity.payload) };
}
async function softDeleteChildren(tx: Prisma.TransactionClient, userId: string, itemId: string, now: Date) {
  const children = await tx.lifeFlowEntity.findMany({ where: { userId, kind: { in: ["habit_log", "item_exception"] }, deletedAt: null } });
  const ids = children.filter((child) => (child.payload as { item_id?: string })?.item_id === itemId).map((child) => child.id);
  if (ids.length) await tx.lifeFlowEntity.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } });
}

export function registerLifeFlowTools(server: McpServer, annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean }) {
  server.registerTool("lifeflow_item", {
    title: "Manage LifeFlow Item",
    description: "Create, update, or delete a habit or event definition. Recurrence is virtual and ends_on is inclusive. Habits require recurrence (omitted recurrence defaults daily); events may be one-off. Timed items may overlap. Changing starts_on, frequency, interval, weekdays, or ends_on requires reset_history=true and soft-deletes logs and exceptions.",
    annotations,
    inputSchema: { action: z.enum(["create", "update", "delete"]), ...itemFields },
  }, async (input) => {
    try {
      requireMcpScope("lifeflow:write");
      const userId = getUserId(), now = new Date(), id = input.id ?? globalThis.crypto.randomUUID();
      const existing = input.action === "create" ? null : await liveItem(userId, id);
      if (existing?.item.system_type) throw new Error("System items cannot be updated or deleted through normal item actions");
      if (input.action === "delete") {
        await prisma.$transaction(async (tx) => { await softDeleteChildren(tx, userId, id, now); await tx.lifeFlowEntity.update({ where: { id: existing!.entity.id }, data: { deletedAt: now } }); });
        return ok("Item deleted.", { id });
      }
      if (input.action === "create" && (!input.kind || !input.name || !input.color || !input.starts_on)) throw new Error("create requires kind, name, color, and starts_on");
      const current = existing?.item;
      if (current && input.kind && input.kind !== current.kind) throw new Error("Item kind cannot be changed after creation");
      const currentRecurrence = current?.recurrence_frequency ? {
        frequency: current.recurrence_frequency,
        interval: current.recurrence_interval,
        weekdays: JSON.parse(current.recurrence_weekdays_json),
        ends_on: current.recurrence_ends_on,
      } : null;
      const selectedRecurrence = input.recurrence === undefined
        ? current ? currentRecurrence : input.kind === "habit" ? { frequency: "daily" as const, interval: 1, weekdays: [], ends_on: null } : null
        : input.recurrence;
      const payload = itemPayloadSchema.parse({
        id, kind: input.kind ?? current?.kind, name: input.name ?? current?.name, color: input.color ?? current?.color,
        starts_on: input.starts_on ?? current?.starts_on, start_time: input.start_time === undefined ? current?.start_time ?? null : input.start_time,
        end_time: input.end_time === undefined ? current?.end_time ?? null : input.end_time,
        break_durations_json: JSON.stringify(input.break_durations ?? JSON.parse(current?.break_durations_json ?? "[]")),
        recurrence_frequency: selectedRecurrence?.frequency ?? null, recurrence_interval: selectedRecurrence?.interval ?? 1,
        recurrence_weekdays_json: JSON.stringify(selectedRecurrence?.weekdays ?? []), recurrence_ends_on: selectedRecurrence?.ends_on ?? null,
        system_type: current?.system_type ?? null, created_at: current?.created_at ?? now.toISOString(),
      });
      const resets = current && recurrenceSignature(current) !== recurrenceSignature(payload);
      if (resets && !input.reset_history) throw new Error("Recurrence changes require reset_history=true because prior logs and exceptions will be deleted");
      await prisma.$transaction(async (tx) => {
        if (resets) await softDeleteChildren(tx, userId, id, now);
        await tx.lifeFlowEntity.upsert({ where: key(userId, "item", id), create: { userId, kind: "item", entityId: id, payload: json(payload) }, update: { payload: json(payload), deletedAt: null } });
      });
      return ok(`Item ${input.action}d.`, { ...payload, break_durations: JSON.parse(payload.break_durations_json), recurrence: selectedRecurrence });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("lifeflow_habit_log", {
    title: "Set LifeFlow Habit Completion",
    description: "Complete or uncomplete one eligible local date. Events and protected system habits cannot be completed manually. Absence of a log means incomplete.", annotations,
    inputSchema: { item_id: z.string(), date: z.string(), completed: z.boolean().default(true) },
  }, async ({ item_id, date, completed }) => {
    try {
      requireMcpScope("lifeflow:write"); const userId = getUserId(), now = new Date();
      const { item } = await liveItem(userId, item_id);
      if (item.kind !== "habit" || item.system_type) throw new Error("Only non-system habits can be completed manually");
      if (!recurrenceApplies(item, date)) throw new Error(`${date} is not an occurrence of habit ${item_id}`);
      const id = `${item_id}|${date}`, payload = { item_id, date, completed_at: now.toISOString(), updated_at: now.toISOString() };
      await prisma.lifeFlowEntity.upsert({ where: key(userId, "habit_log", id), create: { userId, kind: "habit_log", entityId: id, payload, deletedAt: completed ? null : now }, update: { payload, deletedAt: completed ? null : now } });
      return ok("Habit completion updated.", { item_id, date, completed });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("lifeflow_event_occurrence", {
    title: "Manage LifeFlow Event Occurrence",
    description: "Update, move, cancel, or restore one real occurrence of a recurring event. Updates inherit omitted fields and store a complete snapshot. Cancellation and restore use synchronized tombstones; overlap is allowed.", annotations,
    inputSchema: { action: z.enum(["update", "cancel", "restore"]), item_id: z.string(), original_date: z.string(), replacement_date: z.string().optional(), name: z.string().optional(), color: z.string().optional(), start_time: z.string().nullable().optional(), end_time: z.string().nullable().optional(), break_durations: z.array(z.number().int().positive().multipleOf(5)).optional() },
  }, async (input) => {
    try {
      requireMcpScope("lifeflow:write"); const userId = getUserId(), now = new Date();
      const { item } = await liveItem(userId, input.item_id);
      if (item.kind !== "event" || !item.recurrence_frequency || !recurrenceApplies(item, input.original_date)) throw new Error("original_date must be a real occurrence of a recurring event");
      const id = `${input.item_id}|${input.original_date}`;
      if (input.action === "restore") {
        await prisma.lifeFlowEntity.updateMany({ where: { userId, kind: "item_exception", entityId: id }, data: { deletedAt: now } });
        return ok("Event occurrence restored.", { item_id: input.item_id, original_date: input.original_date });
      }
      const replacement = input.action === "cancel" ? null : itemOccurrenceSnapshotSchema.parse({ name: input.name ?? item.name, color: input.color ?? item.color, start_time: input.start_time === undefined ? item.start_time : input.start_time, end_time: input.end_time === undefined ? item.end_time : input.end_time, break_durations_json: JSON.stringify(input.break_durations ?? JSON.parse(item.break_durations_json)) });
      const payload = { item_id: input.item_id, original_date: input.original_date, replacement_date: input.action === "cancel" ? null : input.replacement_date ?? input.original_date, cancelled: input.action === "cancel", replacement, created_at: now.toISOString(), updated_at: now.toISOString() };
      await prisma.lifeFlowEntity.upsert({ where: key(userId, "item_exception", id), create: { userId, kind: "item_exception", entityId: id, payload: json(payload) }, update: { payload: json(payload), deletedAt: null } });
      return ok(input.action === "cancel" ? "Event occurrence cancelled." : "Event occurrence updated.", payload);
    } catch (error) { return toolError(error); }
  });
}
