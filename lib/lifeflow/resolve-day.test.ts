import assert from "node:assert/strict";
import test from "node:test";
import { itemPayloadSchema, lifeFlowEntitySchema, type ItemPayload } from "./contract";
import { recurrenceApplies, resolveItemOccurrences } from "./resolve-day";
import { selectEffectiveLifeFlowMutations } from "./sync-plan";

const item = (overrides: Partial<ItemPayload> = {}) => itemPayloadSchema.parse({
  id: "item", kind: "event", name: "Focus", color: "#5B8CFF", starts_on: "2024-01-31",
  start_time: "19:00", end_time: "20:00", break_durations_json: "[]", recurrence_frequency: "daily",
  recurrence_interval: 1, recurrence_weekdays_json: "[]", recurrence_ends_on: null, system_type: null,
  created_at: "2024-01-01T00:00:00.000Z", ...overrides,
});

test("validates unified identities and rejects old kinds", () => {
  assert.equal(lifeFlowEntitySchema.safeParse({ kind: "habit", id: "old", updatedAt: "2026-08-05T00:00:00.000Z", deleted: true }).success, false);
  assert.equal(lifeFlowEntitySchema.safeParse({ kind: "habit_log", id: "wrong", updatedAt: "2026-08-05T00:00:00.000Z", data: { item_id: "item", date: "2026-08-05", completed_at: "2026-08-05T01:00:00.000Z", updated_at: "2026-08-05T01:00:00.000Z" } }).success, false);
});

test("daily intervals and inclusive ends remain anchored years ahead", () => {
  const value = item({ starts_on: "2020-01-01", recurrence_interval: 3, recurrence_ends_on: "2028-01-01" });
  assert.equal(recurrenceApplies(value, "2027-12-29"), true);
  assert.equal(recurrenceApplies(value, "2028-01-01"), true);
  assert.equal(recurrenceApplies(value, "2028-01-02"), false);
  assert.equal(recurrenceApplies(item({ starts_on: "2026-08-08", recurrence_ends_on: "2026-08-10" }), "2026-08-10"), true);
  assert.equal(recurrenceApplies(item({ starts_on: "2026-08-08", recurrence_ends_on: "2026-08-10" }), "2026-08-11"), false);
});

test("weekly intervals use Monday weeks and selected weekdays", () => {
  const value = item({ starts_on: "2026-08-08", recurrence_frequency: "weekly", recurrence_interval: 2, recurrence_weekdays_json: '["FR","SA"]' });
  assert.equal(recurrenceApplies(value, "2026-08-08"), true);
  assert.equal(recurrenceApplies(value, "2026-08-14"), false);
  assert.equal(recurrenceApplies(value, "2026-08-21"), true);
});

test("monthly and yearly recurrence skip impossible dates", () => {
  const monthly = item({ recurrence_frequency: "monthly" });
  assert.equal(recurrenceApplies(monthly, "2024-02-29"), false);
  assert.equal(recurrenceApplies(monthly, "2024-03-31"), true);
  const yearly = item({ starts_on: "2024-02-29", recurrence_frequency: "yearly" });
  assert.equal(recurrenceApplies(yearly, "2025-02-28"), false);
  assert.equal(recurrenceApplies(yearly, "2028-02-29"), true);
});

test("resolver retains overlaps, applies logs, cancellation, and moves into range", () => {
  const habit = item({ id: "habit", kind: "habit", starts_on: "2026-08-01", start_time: null, end_time: null });
  const event = item({ id: "event", starts_on: "2026-08-01" });
  const other = item({ id: "other", starts_on: "2026-08-01", start_time: "19:30", end_time: "20:30" });
  const exceptions = [
    { item_id: "event", original_date: "2026-08-05", replacement_date: null, cancelled: true, replacement: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
    { item_id: "event", original_date: "2026-08-01", replacement_date: "2026-08-06", cancelled: false, replacement: { name: "Moved", color: "#EF4444", start_time: null, end_time: null, break_durations_json: "[]" }, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
  ];
  const logs = [{ item_id: "habit", date: "2026-08-06", completed_at: "2026-08-06T01:00:00.000Z", updated_at: "2026-08-06T01:00:00.000Z" }];
  const result = resolveItemOccurrences("2026-08-05", 2, [habit, event, other], exceptions, logs);
  assert.equal(result.some((value) => value.itemId === "event" && value.date === "2026-08-05"), false);
  assert.equal(result.find((value) => value.originalDate === "2026-08-01")?.name, "Moved");
  assert.equal(result.find((value) => value.itemId === "habit")?.completed, false);
  assert.equal(result.filter((value) => value.date === "2026-08-06").length, 4);
});

test("stale mutations remain ignored deterministically", () => {
  const effective = selectEffectiveLifeFlowMutations([{ kind: "item", entityId: "item", updatedAt: new Date("2026-08-05T02:00:00.000Z") }], [{ kind: "item", id: "item", updatedAt: "2026-08-05T01:00:00.000Z", deleted: true }]);
  assert.deepEqual(effective, []);
});
