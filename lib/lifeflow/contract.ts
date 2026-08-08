import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

const id = z.string().trim().min(1).max(200);
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "must be a valid local date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:mm");
const iso = z.string().datetime();
export const lifeFlowKinds = ["item", "habit_log", "item_exception"] as const;
export const weekdaySchema = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
export const recurrenceFrequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

// Shared deterministic anchor for system Items created independently by clients.
export const SYSTEM_ITEM_ANCHOR_DATE = "2020-01-01";
export const SYSTEM_ITEM_ANCHOR_TIMESTAMP = "2020-01-01T00:00:00.000Z";

export const systemItemId = (type: "app_check_in" | "journal") =>
  `lifeflow-${type.replaceAll("_", "-")}`;

export function canonicalSystemItem(type: "app_check_in" | "journal") {
  const appearance = type === "app_check_in"
    ? { name: "App check-in", color: "#5B8CFF" }
    : { name: "Daily Journal", color: "#A855F7" };
  return {
    id: systemItemId(type),
    kind: "habit" as const,
    ...appearance,
    starts_on: SYSTEM_ITEM_ANCHOR_DATE,
    start_time: null,
    end_time: null,
    break_durations_json: "[]",
    recurrence_frequency: "daily" as const,
    recurrence_interval: 1,
    recurrence_weekdays_json: "[]",
    recurrence_ends_on: null,
    system_type: type,
    created_at: SYSTEM_ITEM_ANCHOR_TIMESTAMP,
  };
}

export function assertCanonicalSystemItem(item: ItemPayload) {
  if (item.system_type && !isDeepStrictEqual(item, canonicalSystemItem(item.system_type))) {
    throw new Error(`system item ${item.id} must use its canonical id and payload`);
  }
}

const jsonArray = <T>(item: z.ZodType<T>, message: string) => z.string().superRefine((value, ctx) => {
  try { z.array(item).parse(JSON.parse(value)); } catch { ctx.addIssue({ code: "custom", message }); }
});
const breakDurations = jsonArray(z.number().int().positive().multipleOf(5), "must be a JSON array of positive five-minute multiples");
const recurrenceWeekdays = jsonArray(weekdaySchema, "must be a JSON weekday array");
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const duration = (start: string, end: string) => (minutes(end) - minutes(start) + 1440) % 1440;
const parsedArray = (value: string) => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };

const occurrenceSnapshotFields = {
  name: z.string().trim().min(1).max(200), color: z.string().regex(/^#[0-9a-f]{6}$/i, "must be a six-digit hex color"),
  start_time: time.nullable(), end_time: time.nullable(), break_durations_json: breakDurations,
};
export const itemOccurrenceSnapshotSchema = z.object(occurrenceSnapshotFields).strict().superRefine(validateTiming);

function validateTiming(value: { start_time: string | null; end_time: string | null; break_durations_json: string }, ctx: z.RefinementCtx) {
  if ((value.start_time === null) !== (value.end_time === null)) ctx.addIssue({ code: "custom", message: "start_time and end_time must both be set or both be null" });
  const breaks = parsedArray(value.break_durations_json) as number[];
  if (value.start_time === null || value.end_time === null) {
    if (breaks.length) ctx.addIssue({ code: "custom", path: ["break_durations_json"], message: "untimed items cannot have breaks" });
    return;
  }
  const available = duration(value.start_time, value.end_time);
  if (!available) ctx.addIssue({ code: "custom", path: ["end_time"], message: "must differ from start_time" });
  if (breaks.reduce((sum, item) => sum + item, (breaks.length + 1) * 5) > available) ctx.addIssue({ code: "custom", path: ["break_durations_json"], message: "breaks and focus segments exceed item duration" });
}

export const itemPayloadSchema = z.object({
  id, kind: z.enum(["habit", "event"]), ...occurrenceSnapshotFields, starts_on: localDateSchema,
  recurrence_frequency: recurrenceFrequencySchema.nullable(), recurrence_interval: z.number().int().positive(),
  recurrence_weekdays_json: recurrenceWeekdays, recurrence_ends_on: localDateSchema.nullable(),
  system_type: z.enum(["app_check_in", "journal"]).nullable(), created_at: iso,
}).strict().superRefine((value, ctx) => {
  validateTiming(value, ctx);
  const weekdays = parsedArray(value.recurrence_weekdays_json) as string[];
  if (new Set(weekdays).size !== weekdays.length) ctx.addIssue({ code: "custom", path: ["recurrence_weekdays_json"], message: "weekdays must be unique" });
  if (value.kind === "habit" && !value.recurrence_frequency) ctx.addIssue({ code: "custom", path: ["recurrence_frequency"], message: "habits require recurrence" });
  if (!value.recurrence_frequency && value.recurrence_ends_on) ctx.addIssue({ code: "custom", path: ["recurrence_ends_on"], message: "one-off events cannot have recurrence end dates" });
  if (value.recurrence_ends_on && value.recurrence_ends_on < value.starts_on) ctx.addIssue({ code: "custom", path: ["recurrence_ends_on"], message: "must be on or after starts_on" });
  if ((value.recurrence_frequency === "weekly") !== (weekdays.length > 0)) ctx.addIssue({ code: "custom", path: ["recurrence_weekdays_json"], message: "weekly recurrence requires weekdays; other frequencies forbid them" });
  if (value.system_type && (value.kind !== "habit" || value.recurrence_frequency !== "daily" || value.recurrence_interval !== 1 || weekdays.length || value.recurrence_ends_on || value.start_time)) ctx.addIssue({ code: "custom", path: ["system_type"], message: "system items must be indefinite daily untimed habits" });
});

export const habitLogPayloadSchema = z.object({ item_id: id, date: localDateSchema, completed_at: iso, updated_at: iso }).strict();
export const itemExceptionPayloadSchema = z.object({
  item_id: id, original_date: localDateSchema, replacement_date: localDateSchema.nullable(), cancelled: z.boolean(),
  replacement: itemOccurrenceSnapshotSchema.nullable(), created_at: iso, updated_at: iso,
}).strict().superRefine((value, ctx) => {
  if (value.cancelled ? value.replacement_date !== null || value.replacement !== null : value.replacement_date === null || value.replacement === null) ctx.addIssue({ code: "custom", message: "cancelled exceptions have no replacement; overrides require a complete replacement" });
});

const liveEntity = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: itemPayloadSchema }),
  z.object({ kind: z.literal("habit_log"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: habitLogPayloadSchema }),
  z.object({ kind: z.literal("item_exception"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: itemExceptionPayloadSchema }),
]);
const deletedEntity = z.object({ kind: z.enum(lifeFlowKinds), id, updatedAt: iso, deleted: z.literal(true), data: z.null().optional() });
export const lifeFlowEntitySchema = z.union([liveEntity, deletedEntity]).superRefine((entity, ctx) => {
  if (entity.deleted) return;
  const expected = entity.kind === "item" ? entity.data.id : entity.kind === "habit_log" ? `${entity.data.item_id}|${entity.data.date}` : `${entity.data.item_id}|${entity.data.original_date}`;
  if (entity.id !== expected) ctx.addIssue({ code: "custom", path: ["id"], message: `must match payload identity ${expected}` });
});
export const lifeFlowSyncSchema = z.object({ entities: z.array(lifeFlowEntitySchema).max(10000) }).strict();

export type ItemPayload = z.infer<typeof itemPayloadSchema>;
export type HabitLogPayload = z.infer<typeof habitLogPayloadSchema>;
export type ItemExceptionPayload = z.infer<typeof itemExceptionPayloadSchema>;
export type ItemOccurrenceSnapshot = z.infer<typeof itemOccurrenceSnapshotSchema>;
export type LifeFlowSyncEntity = z.infer<typeof lifeFlowEntitySchema>;

export function assertSystemSyncMutation(previous: ItemPayload, entity: LifeFlowSyncEntity) {
  const journalDeletion = entity.deleted && previous.system_type === "journal";
  if (!journalDeletion && (entity.deleted || !isDeepStrictEqual(entity.data, previous))) {
    throw new Error(`system item ${entity.id} cannot be edited or deleted`);
  }
}

export function recurrenceSignature(item: ItemPayload) {
  return JSON.stringify([
    item.starts_on,
    item.recurrence_frequency,
    item.recurrence_interval,
    JSON.parse(item.recurrence_weekdays_json),
    item.recurrence_ends_on,
  ]);
}

export function assertItemDefinitionMutation(previous: ItemPayload, next: ItemPayload, retainedHistory: boolean) {
  if (previous.kind !== next.kind) throw new Error(`item ${next.id}: kind cannot be changed`);
  if (retainedHistory && recurrenceSignature(previous) !== recurrenceSignature(next)) {
    throw new Error(`item ${next.id}: recurrence changes require deleting all logs and exceptions`);
  }
}
