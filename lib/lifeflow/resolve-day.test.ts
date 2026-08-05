import assert from "node:assert/strict";
import test from "node:test";
import { dayPresetSchedulePayloadSchema, lifeFlowEntitySchema, timeBoxPayloadSchema } from "./contract";
import { resolveLifeFlowDay } from "./resolve-day";
import { selectEffectiveLifeFlowMutations } from "./sync-plan";

test("resolves recurring blocks while preserving dismissed snapshots", () => {
  const blocks = [{ id: "block", preset_id: "preset", title: "Focus", start_time: "09:00", end_time: "10:00", color: null, sort_order: 0, break_durations_json: "[]" }];
  const schedules = [{ id: "schedule", preset_id: "preset", start_date: "2026-08-01", frequency: "daily" as const, weekdays_json: "[]", active: 1 as const, created_at: "2026-08-01T00:00:00.000Z" }];
  const virtual = resolveLifeFlowDay("2026-08-05", [], blocks, schedules);
  assert.equal(virtual.length, 1);
  assert.equal(virtual[0].virtual, true);

  const dismissed = [{ ...virtual[0], dismissed: 1 as const, virtual: undefined }];
  assert.equal(resolveLifeFlowDay("2026-08-05", dismissed, blocks, schedules).length, 0);
});

test("rejects malformed payload and mismatched entity identity", () => {
  const result = lifeFlowEntitySchema.safeParse({
    kind: "habit_log", id: "wrong", updatedAt: "2026-08-05T00:00:00.000Z",
    data: { habit_id: "habit", date: "2026-08-05", completed_at: "2026-08-05T01:00:00.000Z" },
  });
  assert.equal(result.success, false);
});

test("ignores a stale parent tombstone before referential validation", () => {
  const effective = selectEffectiveLifeFlowMutations(
    [{ kind: "habit", entityId: "habit", updatedAt: new Date("2026-08-05T02:00:00.000Z") }],
    [{ kind: "habit", id: "habit", updatedAt: "2026-08-05T01:00:00.000Z", deleted: true }],
  );
  assert.deepEqual(effective, []);
});

test("validates client-compatible time ranges, breaks, and schedule weekdays", () => {
  const box = {
    id: "box", date: "2026-08-05", title: "Focus", start_time: "09:00", end_time: "10:00",
    completed: 0, created_at: "2026-08-05T00:00:00.000Z", color: null,
    preset_schedule_id: null, preset_block_id: null, break_durations_json: "[10]", dismissed: 0, habit_id: null,
  };
  assert.equal(timeBoxPayloadSchema.safeParse(box).success, true);
  assert.equal(timeBoxPayloadSchema.safeParse({ ...box, end_time: "09:00" }).success, false);
  assert.equal(timeBoxPayloadSchema.safeParse({ ...box, break_durations_json: "[7]" }).success, false);
  const schedule = { id: "schedule", preset_id: "preset", start_date: "2026-08-05", frequency: "daily", weekdays_json: "[]", active: 1, created_at: "2026-08-05T00:00:00.000Z" };
  assert.equal(dayPresetSchedulePayloadSchema.safeParse(schedule).success, true);
  assert.equal(dayPresetSchedulePayloadSchema.safeParse({ ...schedule, frequency: "weekly" }).success, false);
  assert.equal(dayPresetSchedulePayloadSchema.safeParse({ ...schedule, weekdays_json: "[7]" }).success, false);
});
