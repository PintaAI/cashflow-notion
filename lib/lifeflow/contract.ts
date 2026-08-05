import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:mm");
const iso = z.string().datetime();
export const lifeFlowKinds = ["habit", "habit_log", "time_box", "day_preset", "day_preset_block", "day_preset_schedule"] as const;
const jsonIntegerArray = z.string().refine((value) => {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) && parsed.every(Number.isInteger); } catch { return false; }
}, "must be a JSON integer array");
const weekdayArray = jsonIntegerArray.refine((value) => {
  const parsed = JSON.parse(value) as number[];
  return parsed.every((day) => day >= 0 && day <= 6);
}, "must contain weekdays 0-6");
const weekdays = weekdayArray.refine((value) => (JSON.parse(value) as number[]).length > 0, "must contain at least one weekday");
const breakDurations = jsonIntegerArray.refine((value) => (
  (JSON.parse(value) as number[]).every((duration) => duration > 0 && duration % 5 === 0)
), "break durations must be positive multiples of 5");
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
function duration(start: string, end: string) {
  const value = minutes(end) - minutes(start);
  return value > 0 ? value : value + 1440;
}
function validateRange(value: { start_time: string; end_time: string; break_durations_json: string }, ctx: z.RefinementCtx) {
  if (value.start_time === value.end_time) ctx.addIssue({ code: "custom", path: ["end_time"], message: "must differ from start_time" });
  let breaks: number[];
  try {
    const parsed = JSON.parse(value.break_durations_json);
    if (!Array.isArray(parsed)) return;
    breaks = parsed as number[];
  } catch { return; }
  if (breaks.reduce((sum, item) => sum + item, (breaks.length + 1) * 5) > duration(value.start_time, value.end_time)) {
    ctx.addIssue({ code: "custom", path: ["break_durations_json"], message: "breaks and focus segments exceed time-box duration" });
  }
}

export const habitPayloadSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  color: z.string().trim().min(1).max(40),
  created_at: iso,
  weekdays_json: weekdays,
  preferred_duration: z.number().int().min(5).max(1440),
  system_type: z.enum(["app_check_in", "journal"]).nullable().optional(),
}).strict();

export const habitLogPayloadSchema = z.object({ habit_id: id, date, completed_at: iso }).strict();
export const timeBoxPayloadSchema = z.object({
  id, date, title: z.string().trim().min(1).max(200), start_time: time, end_time: time,
  completed: z.union([z.literal(0), z.literal(1)]), created_at: iso,
  color: z.string().max(40).nullable(), preset_schedule_id: id.nullable(), preset_block_id: id.nullable(),
  break_durations_json: breakDurations, dismissed: z.union([z.literal(0), z.literal(1)]), habit_id: id.nullable(),
}).strict().superRefine((value, ctx) => {
  validateRange(value, ctx);
  if (Boolean(value.preset_schedule_id) !== Boolean(value.preset_block_id)) ctx.addIssue({ code: "custom", message: "preset_schedule_id and preset_block_id must both be set or both be null" });
});
export const dayPresetPayloadSchema = z.object({ id, name: z.string().trim().min(1).max(200), created_at: iso }).strict();
export const dayPresetBlockPayloadSchema = z.object({
  id, preset_id: id, title: z.string().trim().min(1).max(200), start_time: time, end_time: time,
  color: z.string().max(40).nullable(), sort_order: z.number().int().min(0), break_durations_json: breakDurations,
}).strict().superRefine(validateRange);
export const dayPresetSchedulePayloadSchema = z.object({
  id, preset_id: id, start_date: date, frequency: z.enum(["once", "daily", "weekly"]),
  weekdays_json: z.string(), active: z.union([z.literal(0), z.literal(1)]), created_at: iso,
}).strict().superRefine((value, ctx) => {
  const parsed = weekdayArray.safeParse(value.weekdays_json);
  if (!parsed.success) ctx.addIssue({ code: "custom", path: ["weekdays_json"], message: "must be a JSON array containing only weekdays 0-6" });
  else if (value.frequency === "weekly" && (JSON.parse(value.weekdays_json) as number[]).length === 0) ctx.addIssue({ code: "custom", path: ["weekdays_json"], message: "weekly schedules require at least one weekday" });
});

const liveEntity = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("habit"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: habitPayloadSchema }),
  z.object({ kind: z.literal("habit_log"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: habitLogPayloadSchema }),
  z.object({ kind: z.literal("time_box"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: timeBoxPayloadSchema }),
  z.object({ kind: z.literal("day_preset"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: dayPresetPayloadSchema }),
  z.object({ kind: z.literal("day_preset_block"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: dayPresetBlockPayloadSchema }),
  z.object({ kind: z.literal("day_preset_schedule"), id, updatedAt: iso, deleted: z.literal(false).optional(), data: dayPresetSchedulePayloadSchema }),
]);
const deletedEntity = z.object({
  kind: z.enum(lifeFlowKinds),
  id, updatedAt: iso, deleted: z.literal(true), data: z.null().optional(),
});

export const lifeFlowEntitySchema = z.union([liveEntity, deletedEntity]).superRefine((entity, ctx) => {
  if (entity.deleted) return;
  const expectedId = entity.kind === "habit_log" ? `${entity.data.habit_id}|${entity.data.date}` : entity.data.id;
  if (entity.id !== expectedId) ctx.addIssue({ code: "custom", path: ["id"], message: `must match payload identity ${expectedId}` });
});

export const lifeFlowSyncSchema = z.object({
  managementId: id,
  entities: z.array(lifeFlowEntitySchema).max(10000),
}).strict();

export type LifeFlowSyncEntity = z.infer<typeof lifeFlowEntitySchema>;
