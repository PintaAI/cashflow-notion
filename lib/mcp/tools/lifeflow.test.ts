import assert from "node:assert/strict";
import test from "node:test";
import { assertCanonicalSystemItem, assertItemDefinitionMutation, assertSystemSyncMutation, canonicalSystemItem, itemPayloadSchema, itemExceptionPayloadSchema } from "@/lib/lifeflow/contract";
import { recurrenceApplies } from "@/lib/lifeflow/resolve-day";

test("MCP payload validation shares item timing and recurrence rules", () => {
  const base = { id: "x", kind: "habit", name: "Read", color: "#5B8CFF", starts_on: "2026-08-08", start_time: null, end_time: null, break_durations_json: "[]", recurrence_frequency: "daily", recurrence_interval: 1, recurrence_weekdays_json: "[]", recurrence_ends_on: null, system_type: null, created_at: "2026-08-08T00:00:00.000Z" };
  assert.equal(itemPayloadSchema.safeParse(base).success, true);
  assert.equal(itemPayloadSchema.safeParse({ ...base, color: "blue" }).success, false);
  assert.equal(itemPayloadSchema.safeParse({ ...base, recurrence_frequency: null }).success, false);
  assert.equal(itemPayloadSchema.safeParse({ ...base, start_time: "09:00" }).success, false);
  assert.equal(itemPayloadSchema.safeParse({ ...base, start_time: "22:00", end_time: "02:00", break_durations_json: "[10]" }).success, true);
});

test("event exception requires cancellation xor a complete replacement", () => {
  const base = { item_id: "x", original_date: "2026-08-08", created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" };
  assert.equal(itemExceptionPayloadSchema.safeParse({ ...base, cancelled: true, replacement_date: null, replacement: null }).success, true);
  assert.equal(itemExceptionPayloadSchema.safeParse({ ...base, cancelled: false, replacement_date: "2026-08-09", replacement: null }).success, false);
});

test("inclusive ends are enforced for MCP eligibility without generating rows", () => {
  const item = itemPayloadSchema.parse({ id: "x", kind: "event", name: "Read", color: "#5B8CFF", starts_on: "2026-08-08", start_time: null, end_time: null, break_durations_json: "[]", recurrence_frequency: "daily", recurrence_interval: 1, recurrence_weekdays_json: "[]", recurrence_ends_on: "2026-08-09", system_type: null, created_at: "2026-08-08T00:00:00.000Z" });
  assert.equal(recurrenceApplies(item, "2026-08-09"), true);
  assert.equal(recurrenceApplies(item, "2026-08-10"), false);
});

test("sync accepts only canonical first creation of deterministic system Items", () => {
  const checkIn = canonicalSystemItem("app_check_in");
  const journal = canonicalSystemItem("journal");
  assert.equal(itemPayloadSchema.safeParse(checkIn).success, true);
  assert.equal(itemPayloadSchema.safeParse(journal).success, true);
  assert.equal(checkIn.starts_on, journal.starts_on);
  assert.equal(checkIn.created_at, journal.created_at);
  assert.doesNotThrow(() => assertCanonicalSystemItem(itemPayloadSchema.parse(checkIn)));
  assert.throws(() => assertCanonicalSystemItem({ ...checkIn, starts_on: "2026-08-08" }), /canonical id and payload/);
});

test("sync permits optional journal deletion but protects app check-in and all system edits", () => {
  const updatedAt = "2026-08-08T00:00:00.000Z";
  const journal = canonicalSystemItem("journal");
  const checkIn = canonicalSystemItem("app_check_in");
  assert.doesNotThrow(() => assertSystemSyncMutation(journal, {
    kind: "item", id: journal.id, updatedAt, deleted: true,
  }));
  assert.throws(() => assertSystemSyncMutation(checkIn, {
    kind: "item", id: checkIn.id, updatedAt, deleted: true,
  }), /cannot be edited or deleted/);
  assert.throws(() => assertSystemSyncMutation(journal, {
    kind: "item", id: journal.id, updatedAt, data: { ...journal, name: "Edited" },
  }), /cannot be edited or deleted/);
});

test("sync requires recurrence history deletion and keeps Item kind immutable", () => {
  const current = itemPayloadSchema.parse({ id: "x", kind: "habit", name: "Read", color: "#5B8CFF", starts_on: "2026-08-08", start_time: null, end_time: null, break_durations_json: "[]", recurrence_frequency: "daily", recurrence_interval: 1, recurrence_weekdays_json: "[]", recurrence_ends_on: null, system_type: null, created_at: "2026-08-08T00:00:00.000Z" });
  const changedRecurrence = itemPayloadSchema.parse({ ...current, recurrence_frequency: "weekly", recurrence_weekdays_json: '["SA"]' });
  const changedKind = itemPayloadSchema.parse({ ...current, kind: "event" });
  assert.throws(() => assertItemDefinitionMutation(current, changedRecurrence, true), /deleting all logs and exceptions/);
  assert.doesNotThrow(() => assertItemDefinitionMutation(current, changedRecurrence, false));
  assert.throws(() => assertItemDefinitionMutation(current, changedKind, false), /kind cannot be changed/);
});
