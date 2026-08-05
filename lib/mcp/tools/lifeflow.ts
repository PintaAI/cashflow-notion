import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dayPresetBlockPayloadSchema, dayPresetPayloadSchema, dayPresetSchedulePayloadSchema, habitPayloadSchema, timeBoxPayloadSchema } from "@/lib/lifeflow/contract";
import { resolveLifeFlowDay } from "@/lib/lifeflow/resolve-day";
import { getManagementId, isValidDate, ok, requireMcpScope, toolError } from "./utils";
import { internalBlockConflict, occurrenceConflict, recurringManualConflict, recurringSeriesConflict, weekdaysForRepeat, type ConflictBlock } from "./lifeflow-schedule";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekdays = z.array(z.number().int().min(0).max(6)).min(1);
const json = (value: unknown) => value as Prisma.InputJsonValue;
const key = (managementId: string, kind: string, entityId: string) => ({ managementId_kind_entityId: { managementId, kind, entityId } });
type Entity = { kind: string; entityId: string; payload: Prisma.JsonValue; deletedAt: Date | null };

function occurrenceDate(id: string, date?: string) {
  const resolved = date ?? id.match(/(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (!resolved || !isValidDate(resolved)) throw new Error("date is required as YYYY-MM-DD for this occurrence");
  return resolved;
}

function parseEntities(entities: Entity[]) {
  const ofKind = <T>(kind: string, schema: z.ZodType<T>) => entities.filter((item) => item.kind === kind && !item.deletedAt).map((item) => schema.parse(item.payload));
  return {
    boxes: ofKind("time_box", timeBoxPayloadSchema), blocks: ofKind("day_preset_block", dayPresetBlockPayloadSchema),
    schedules: ofKind("day_preset_schedule", dayPresetSchedulePayloadSchema),
  };
}

async function resolveOccurrence(managementId: string, id: string, date?: string) {
  const entities = await prisma.lifeFlowEntity.findMany({ where: { managementId } });
  const stored = entities.find((item) => item.kind === "time_box" && item.entityId === id && !item.deletedAt);
  if (stored) return timeBoxPayloadSchema.parse(stored.payload);
  const parsed = parseEntities(entities);
  const virtual = resolveLifeFlowDay(occurrenceDate(id, date), parsed.boxes, parsed.blocks, parsed.schedules).find((box) => box.id === id);
  if (!virtual) throw new Error(`schedule occurrence ${id} not found; call lifeflow_today for the target date first`);
  const { virtual: _virtual, ...payload } = virtual;
  void _virtual;
  return timeBoxPayloadSchema.parse(payload);
}

async function validateHabitLink(managementId: string, habitId: string | null) {
  if (!habitId) return;
  const entity = await prisma.lifeFlowEntity.findUnique({ where: key(managementId, "habit", habitId) });
  if (!entity || entity.deletedAt) throw new Error(`habit ${habitId} not found`);
  if (habitPayloadSchema.parse(entity.payload).system_type) throw new Error("System habits cannot be linked to schedule blocks");
}

async function assertOccurrenceAvailable(managementId: string, candidate: z.infer<typeof timeBoxPayloadSchema>, excludeId?: string) {
  const entities = await prisma.lifeFlowEntity.findMany({ where: { managementId } });
  const parsed = parseEntities(entities);
  const effective = resolveLifeFlowDay(candidate.date, parsed.boxes, parsed.blocks, parsed.schedules);
  const conflict = occurrenceConflict(candidate, effective, excludeId);
  if (conflict) throw new Error(`Schedule conflict on ${candidate.date} with occurrence ${conflict.id}: choose a different time or color.`);
}

async function assertRecurringAvailable(
  managementId: string,
  frequency: "daily" | "weekly",
  weekdays: number[],
  startDate: string,
  blocks: ConflictBlock[],
  excludeSeriesId?: string,
) {
  if (internalBlockConflict(blocks)) throw new Error("Recurring schedule contains blocks that overlap or reuse a color within the same series.");
  const entities = await prisma.lifeFlowEntity.findMany({ where: { managementId } });
  const parsed = parseEntities(entities);
  const blocksBySeries = new Map<string, ConflictBlock[]>();
  for (const block of parsed.blocks) blocksBySeries.set(block.preset_id, [...(blocksBySeries.get(block.preset_id) ?? []), block]);
  const active = parsed.schedules.filter((schedule) => schedule.active === 1).map((schedule) => ({
    id: schedule.preset_id,
    weekdays: schedule.frequency === "daily" ? weekdaysForRepeat("daily") : JSON.parse(schedule.weekdays_json) as number[],
    blocks: blocksBySeries.get(schedule.preset_id) ?? [],
  }));
  const seriesConflict = recurringSeriesConflict({ id: excludeSeriesId ?? "candidate", weekdays, blocks }, active, excludeSeriesId);
  if (seriesConflict) throw new Error(`Recurring schedule conflicts with active series ${seriesConflict.id} on a shared weekday: choose a different time, color, or weekday.`);
  const manualConflict = recurringManualConflict(frequency, weekdays, startDate, blocks, parsed.boxes);
  if (manualConflict) throw new Error(`Recurring schedule conflicts with existing time block ${manualConflict.id} on ${manualConflict.date}: choose a different time, color, weekday, or start date.`);
}

export function registerLifeFlowTools(server: McpServer, annotations: { readOnlyHint: boolean; destructiveHint: boolean; openWorldHint: boolean }) {
  server.registerTool("lifeflow_habit", {
    title: "Manage LifeFlow Habit",
    description: "Create, update, delete, or complete a recurring habit. weekdays uses 0=Sunday through 6=Saturday. Create requires name, color, weekdays, and preferred_duration. Complete requires id and date; completed defaults to true. System habits retain their protections, and linked schedule completion stays synchronized.",
    annotations,
    inputSchema: {
      action: z.enum(["create", "update", "delete", "complete"]), id: z.string().optional(),
      name: z.string().trim().min(1).max(200).optional(), color: z.string().trim().min(1).max(40).optional(), weekdays: weekdays.optional(),
      preferred_duration: z.number().int().min(5).max(1440).optional(), date: z.string().optional(), completed: z.boolean().optional(),
    },
  }, async (input) => {
    try {
      requireMcpScope("lifeflow:write");
      const managementId = getManagementId();
      const now = new Date();
      const id = input.id ?? globalThis.crypto.randomUUID();
      const existing = await prisma.lifeFlowEntity.findUnique({ where: key(managementId, "habit", id) });
      if (input.action !== "create" && (!existing || existing.deletedAt)) throw new Error(`habit ${id} not found`);
      if (input.action === "create" && (!input.name || !input.color || !input.weekdays || !input.preferred_duration)) throw new Error("create requires name, color, weekdays, and preferred_duration");
      const current = existing ? habitPayloadSchema.parse(existing.payload) : null;
      if (input.action === "delete") {
        if (current?.system_type) throw new Error("System habits cannot be deleted");
        const dependents = await prisma.lifeFlowEntity.findMany({ where: { managementId, kind: { in: ["habit_log", "time_box"] }, deletedAt: null } });
        await prisma.$transaction(async (tx) => {
          await tx.lifeFlowEntity.update({ where: key(managementId, "habit", id), data: { deletedAt: now } });
          for (const dependent of dependents) {
            if ((dependent.payload as { habit_id?: string })?.habit_id !== id) continue;
            const box = dependent.kind === "time_box" ? timeBoxPayloadSchema.parse(dependent.payload) : null;
            await tx.lifeFlowEntity.update({ where: { id: dependent.id }, data: box?.completed ? { payload: json({ ...box, habit_id: null }) } : { deletedAt: now } });
          }
        });
        return ok("Habit deleted.", { id });
      }
      if (input.action === "complete") {
        if (!input.date || !isValidDate(input.date)) throw new Error("complete requires date in YYYY-MM-DD");
        if (current?.system_type === "journal") throw new Error("Journal completion is recorded from journal activity and cannot be set manually");
        const completed = input.completed !== false;
        const logId = `${id}|${input.date}`;
        const boxes = await prisma.lifeFlowEntity.findMany({ where: { managementId, kind: "time_box", deletedAt: null } });
        await prisma.$transaction(async (tx) => {
          const payload = { habit_id: id, date: input.date!, completed_at: now.toISOString() };
          await tx.lifeFlowEntity.upsert({ where: key(managementId, "habit_log", logId), create: { managementId, kind: "habit_log", entityId: logId, payload, deletedAt: completed ? null : now }, update: { payload, deletedAt: completed ? null : now } });
          for (const entity of boxes) { const box = timeBoxPayloadSchema.parse(entity.payload); if (box.habit_id === id && box.date === input.date && !box.dismissed) await tx.lifeFlowEntity.update({ where: { id: entity.id }, data: { payload: json({ ...box, completed: completed ? 1 : 0 }) } }); }
        });
        return ok("Habit completion updated.", { id, date: input.date, completed });
      }
      const payload = habitPayloadSchema.parse({ id, created_at: current?.created_at ?? now.toISOString(), system_type: current?.system_type ?? null, name: input.name ?? current?.name, color: input.color ?? current?.color, weekdays_json: JSON.stringify(input.weekdays ?? JSON.parse(current?.weekdays_json ?? "[]")), preferred_duration: input.preferred_duration ?? current?.preferred_duration });
      await prisma.lifeFlowEntity.upsert({ where: key(managementId, "habit", id), create: { managementId, kind: "habit", entityId: id, payload: json(payload) }, update: { payload: json(payload), deletedAt: null } });
      return ok(`Habit ${input.action}d.`, { ...payload, weekdays: JSON.parse(payload.weekdays_json), weekdays_json: undefined });
    } catch (error) { return toolError(error); }
  });

  server.registerTool("lifeflow_schedule", {
    title: "Manage LifeFlow Schedule",
    description: "Create, update, delete, or complete natural-language time blocks such as 'Coding every Wednesday 19:00-21:00'. Weekdays map 0=Sunday through 6=Saturday. Create requires date (the deterministic series start date), title, start_time, and end_time; repeat defaults to none, weekly also requires weekdays. Use scope=occurrence (default) with id from lifeflow_today to change, dismiss, or complete one date, including virtual occurrences. Use scope=series with series_id and block_id to change a recurring block/rule while preserving other blocks, or series_id to stop the entire series.",
    annotations,
    inputSchema: {
      action: z.enum(["create", "update", "delete", "complete"]), scope: z.enum(["occurrence", "series"]).default("occurrence"),
      id: z.string().optional(), series_id: z.string().optional(), block_id: z.string().optional(), date: z.string().optional(), start_date: z.string().optional(),
      title: z.string().trim().min(1).max(200).optional(), start_time: time.optional(), end_time: time.optional(), color: z.string().max(40).nullable().optional(),
      break_durations: z.array(z.number().int().positive().multipleOf(5)).optional(), habit_id: z.string().nullable().optional(),
      repeat: z.enum(["none", "daily", "weekly"]).optional(), weekdays: weekdays.optional(), completed: z.boolean().optional(),
    },
  }, async (input) => {
    try {
      requireMcpScope("lifeflow:write");
      const managementId = getManagementId();
      const now = new Date();
      if (input.action === "create") {
        const date = input.start_date ?? input.date;
        if (!date || !isValidDate(date) || !input.title || !input.start_time || !input.end_time) throw new Error("create requires date (or start_date), title, start_time, and end_time");
        await validateHabitLink(managementId, input.habit_id ?? null);
        const repeat = input.repeat ?? "none";
        if (repeat === "none") {
          const id = globalThis.crypto.randomUUID();
          const payload = timeBoxPayloadSchema.parse({ id, date, title: input.title, start_time: input.start_time, end_time: input.end_time, color: input.color ?? null, break_durations_json: JSON.stringify(input.break_durations ?? []), habit_id: input.habit_id ?? null, completed: 0, dismissed: 0, preset_schedule_id: null, preset_block_id: null, created_at: now.toISOString() });
          await assertOccurrenceAvailable(managementId, payload);
          await prisma.lifeFlowEntity.create({ data: { managementId, kind: "time_box", entityId: id, payload: json(payload) } });
          return ok("Schedule occurrence created.", { id, date });
        }
        if (input.habit_id) throw new Error("Recurring schedule blocks cannot link a habit; habits already define their own recurrence");
        const seriesId = globalThis.crypto.randomUUID(), blockId = globalThis.crypto.randomUUID(), scheduleId = globalThis.crypto.randomUUID();
        const days = weekdaysForRepeat(repeat, input.weekdays);
        const preset = dayPresetPayloadSchema.parse({ id: seriesId, name: input.title, created_at: now.toISOString() });
        const block = dayPresetBlockPayloadSchema.parse({ id: blockId, preset_id: seriesId, title: input.title, start_time: input.start_time, end_time: input.end_time, color: input.color ?? null, break_durations_json: JSON.stringify(input.break_durations ?? []), sort_order: 0 });
        const schedule = dayPresetSchedulePayloadSchema.parse({ id: scheduleId, preset_id: seriesId, start_date: date, frequency: repeat, weekdays_json: JSON.stringify(days), active: 1, created_at: now.toISOString() });
        await assertRecurringAvailable(managementId, repeat, days, date, [block]);
        await prisma.$transaction([prisma.lifeFlowEntity.create({ data: { managementId, kind: "day_preset", entityId: seriesId, payload: json(preset) } }), prisma.lifeFlowEntity.create({ data: { managementId, kind: "day_preset_block", entityId: blockId, payload: json(block) } }), prisma.lifeFlowEntity.create({ data: { managementId, kind: "day_preset_schedule", entityId: scheduleId, payload: json(schedule) } })]);
        return ok("Schedule series created.", { series_id: seriesId, schedule_id: scheduleId, block_id: blockId, start_date: date, repeat, weekdays: days });
      }
      if (input.scope === "series") {
        if (!input.series_id) throw new Error("series scope requires series_id");
        const scheduleEntity = await prisma.lifeFlowEntity.findFirst({ where: { managementId, kind: "day_preset_schedule", deletedAt: null, payload: { path: ["preset_id"], equals: input.series_id } } });
        if (!scheduleEntity) throw new Error(`series ${input.series_id} not found`);
        const schedule = dayPresetSchedulePayloadSchema.parse(scheduleEntity.payload);
        if (input.action === "delete") { await prisma.lifeFlowEntity.update({ where: { id: scheduleEntity.id }, data: { payload: json({ ...schedule, active: 0 }) } }); return ok("Schedule series stopped.", { series_id: input.series_id }); }
        if (input.action !== "update") throw new Error("series scope supports update or delete");
        if (!input.block_id) throw new Error("series update requires block_id");
        const blockEntity = await prisma.lifeFlowEntity.findUnique({ where: key(managementId, "day_preset_block", input.block_id) });
        if (!blockEntity || blockEntity.deletedAt) throw new Error(`block ${input.block_id} not found`);
        const block = dayPresetBlockPayloadSchema.parse(blockEntity.payload);
        if (block.preset_id !== input.series_id) throw new Error("block_id does not belong to series_id");
        const repeat = input.repeat ?? (schedule.frequency === "once" ? "none" : schedule.frequency);
        const days = input.weekdays ? weekdaysForRepeat(repeat, input.weekdays) : repeat === "daily" ? weekdaysForRepeat("daily") : JSON.parse(schedule.weekdays_json);
        const nextBlock = dayPresetBlockPayloadSchema.parse({ ...block, ...(input.title === undefined ? {} : { title: input.title }), ...(input.start_time === undefined ? {} : { start_time: input.start_time }), ...(input.end_time === undefined ? {} : { end_time: input.end_time }), ...(input.color === undefined ? {} : { color: input.color }), ...(input.break_durations === undefined ? {} : { break_durations_json: JSON.stringify(input.break_durations) }) });
        const nextSchedule = dayPresetSchedulePayloadSchema.parse({ ...schedule, start_date: input.start_date ?? schedule.start_date, frequency: repeat === "none" ? schedule.frequency : repeat, weekdays_json: JSON.stringify(days), active: repeat === "none" ? 0 : 1 });
        if (repeat !== "none") {
          const seriesBlocks = await prisma.lifeFlowEntity.findMany({ where: { managementId, kind: "day_preset_block", deletedAt: null, payload: { path: ["preset_id"], equals: input.series_id } } });
          const candidates = seriesBlocks.map((entity) => entity.entityId === input.block_id ? nextBlock : dayPresetBlockPayloadSchema.parse(entity.payload));
          await assertRecurringAvailable(managementId, repeat, days, nextSchedule.start_date, candidates, input.series_id);
        }
        await prisma.$transaction([prisma.lifeFlowEntity.update({ where: { id: blockEntity.id }, data: { payload: json(nextBlock) } }), prisma.lifeFlowEntity.update({ where: { id: scheduleEntity.id }, data: { payload: json(nextSchedule) } })]);
        return ok("Schedule series updated.", { series_id: input.series_id, block_id: input.block_id, repeat, weekdays: days });
      }
      if (!input.id) throw new Error("occurrence action requires id from lifeflow_today");
      const current = await resolveOccurrence(managementId, input.id, input.date);
      await validateHabitLink(managementId, input.habit_id === undefined ? current.habit_id : input.habit_id);
      const payload = timeBoxPayloadSchema.parse({ ...current, ...(input.date === undefined ? {} : { date: input.date }), ...(input.title === undefined ? {} : { title: input.title }), ...(input.start_time === undefined ? {} : { start_time: input.start_time }), ...(input.end_time === undefined ? {} : { end_time: input.end_time }), ...(input.color === undefined ? {} : { color: input.color }), ...(input.break_durations === undefined ? {} : { break_durations_json: JSON.stringify(input.break_durations) }), ...(input.habit_id === undefined ? {} : { habit_id: input.habit_id }), ...(input.action === "delete" ? { dismissed: current.preset_schedule_id ? 1 : 0 } : {}), ...(input.action === "complete" ? { completed: input.completed === false ? 0 : 1 } : {}) });
      if (input.action === "update") await assertOccurrenceAvailable(managementId, payload, input.id);
      await prisma.$transaction(async (tx) => {
        if (input.action === "delete" && !current.preset_schedule_id) await tx.lifeFlowEntity.updateMany({ where: { managementId, kind: "time_box", entityId: input.id }, data: { deletedAt: now } });
        else await tx.lifeFlowEntity.upsert({ where: key(managementId, "time_box", input.id!), create: { managementId, kind: "time_box", entityId: input.id!, payload: json(payload) }, update: { payload: json(payload), deletedAt: null } });
        if (input.action === "complete" && payload.habit_id) {
          const logId = `${payload.habit_id}|${payload.date}`, completed = input.completed !== false, log = { habit_id: payload.habit_id, date: payload.date, completed_at: now.toISOString() };
          await tx.lifeFlowEntity.upsert({ where: key(managementId, "habit_log", logId), create: { managementId, kind: "habit_log", entityId: logId, payload: log, deletedAt: completed ? null : now }, update: { payload: log, deletedAt: completed ? null : now } });
        }
      });
      const parentSchedule = payload.preset_schedule_id
        ? await prisma.lifeFlowEntity.findUnique({ where: key(managementId, "day_preset_schedule", payload.preset_schedule_id) })
        : null;
      const seriesId = parentSchedule && !parentSchedule.deletedAt ? dayPresetSchedulePayloadSchema.parse(parentSchedule.payload).preset_id : null;
      return ok(`Schedule occurrence ${input.action}d.`, { id: input.id, date: payload.date, series_id: seriesId, block_id: payload.preset_block_id, completed: payload.completed === 1 });
    } catch (error) { return toolError(error); }
  });
}
