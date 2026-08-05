export function weekdaysForRepeat(repeat: "none" | "daily" | "weekly", selected?: number[]) {
  if (repeat === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (repeat === "weekly") {
    if (!selected?.length) throw new Error("weekdays is required for weekly repeat (0=Sunday, 6=Saturday)");
    return [...new Set(selected)].sort();
  }
  return [];
}

export type ConflictBlock = { start_time: string; end_time: string; color: string | null };
export type ConflictBox = ConflictBlock & { id: string; date: string; dismissed?: number; preset_schedule_id?: string | null };
export type ConflictSeries = { id: string; weekdays: number[]; blocks: ConflictBlock[] };

function minutes(value: string) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

function ranges(block: ConflictBlock) {
  const start = minutes(block.start_time), end = minutes(block.end_time);
  return end > start ? [[start, end]] : [[start, 1440], [0, end]];
}

export function blocksConflict(left: ConflictBlock, right: ConflictBlock) {
  const overlap = ranges(left).some(([start, end]) => ranges(right).some(([otherStart, otherEnd]) => start < otherEnd && otherStart < end));
  return overlap || (left.color !== null && left.color === right.color);
}

export function occurrenceConflict(candidate: ConflictBox, effective: ConflictBox[], excludeId?: string) {
  return effective.find((box) => box.id !== excludeId && blocksConflict(candidate, box));
}

export function scheduleApplies(frequency: "daily" | "weekly", weekdays: number[], startDate: string, date: string) {
  if (date < startDate) return false;
  if (frequency === "daily") return true;
  return weekdays.includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
}

export function recurringSeriesConflict(candidate: ConflictSeries, active: ConflictSeries[], excludeSeriesId?: string) {
  return active.find((series) => series.id !== excludeSeriesId
    && candidate.weekdays.some((day) => series.weekdays.includes(day))
    && candidate.blocks.some((block) => series.blocks.some((other) => blocksConflict(block, other))));
}

export function internalBlockConflict(blocks: ConflictBlock[]) {
  return blocks.some((block, index) => blocks.slice(index + 1).some((other) => blocksConflict(block, other)));
}

export function recurringManualConflict(
  frequency: "daily" | "weekly",
  weekdays: number[],
  startDate: string,
  blocks: ConflictBlock[],
  stored: ConflictBox[],
) {
  return stored.find((box) => !box.dismissed && !box.preset_schedule_id && box.date >= startDate
    && scheduleApplies(frequency, weekdays, startDate, box.date)
    && blocks.some((block) => blocksConflict(block, box)));
}
