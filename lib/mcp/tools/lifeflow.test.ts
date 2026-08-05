import assert from "node:assert/strict";
import test from "node:test";
import { blocksConflict, internalBlockConflict, occurrenceConflict, recurringManualConflict, recurringSeriesConflict, weekdaysForRepeat } from "./lifeflow-schedule";

test("maps public repeat values to deterministic weekday rules", () => {
  assert.deepEqual(weekdaysForRepeat("daily"), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(weekdaysForRepeat("weekly", [5, 1, 5]), [1, 5]);
  assert.deepEqual(weekdaysForRepeat("none", [2]), []);
  assert.throws(() => weekdaysForRepeat("weekly"), /weekdays is required/);
});

const block = (start_time: string, end_time: string, color: string | null = null) => ({ start_time, end_time, color });

test("detects overlap, overnight overlap, and color-only collision", () => {
  assert.equal(blocksConflict(block("09:00", "10:00"), block("09:30", "11:00")), true);
  assert.equal(blocksConflict(block("22:00", "02:00"), block("01:00", "03:00")), true);
  assert.equal(blocksConflict(block("22:00", "02:00"), block("03:00", "04:00")), false);
  assert.equal(blocksConflict(block("09:00", "10:00", "#abc"), block("11:00", "12:00", "#abc")), true);
});

test("occurrence validation excludes only the current occurrence", () => {
  const effective = [{ id: "self", date: "2026-08-05", ...block("09:00", "10:00") }, { id: "other", date: "2026-08-05", ...block("11:00", "12:00", "red") }];
  assert.equal(occurrenceConflict({ id: "self", date: "2026-08-05", ...block("09:30", "10:30") }, effective, "self"), undefined);
  assert.equal(occurrenceConflict({ id: "self", date: "2026-08-05", ...block("10:30", "11:30") }, effective, "self")?.id, "other");
});

test("recurring validation respects weekday intersection and current-series exclusion", () => {
  const candidate = { id: "candidate", weekdays: [3], blocks: [block("19:00", "21:00")] };
  const active = [{ id: "monday", weekdays: [1], blocks: [block("19:00", "21:00")] }, { id: "current", weekdays: [3], blocks: [block("19:30", "20:00")] }];
  assert.equal(recurringSeriesConflict(candidate, active), active[1]);
  assert.equal(recurringSeriesConflict(candidate, active, "current"), undefined);
});

test("detects conflicts between blocks inside the same series", () => {
  assert.equal(internalBlockConflict([block("09:00", "10:00"), block("09:30", "11:00")]), true);
  assert.equal(internalBlockConflict([block("09:00", "10:00"), block("10:00", "11:00")]), false);
});

test("recurring validation checks only applicable manual dates", () => {
  const stored = [{ id: "tuesday", date: "2026-08-04", ...block("19:00", "20:00") }, { id: "wednesday", date: "2026-08-05", ...block("19:00", "20:00") }];
  assert.equal(recurringManualConflict("weekly", [3], "2026-08-01", [block("19:30", "21:00")], stored)?.id, "wednesday");
  assert.equal(recurringManualConflict("weekly", [1], "2026-08-10", [block("19:30", "21:00")], stored), undefined);
});
