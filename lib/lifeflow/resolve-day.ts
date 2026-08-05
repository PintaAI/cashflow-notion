import type { z } from "zod";
import type { dayPresetBlockPayloadSchema, dayPresetSchedulePayloadSchema, timeBoxPayloadSchema } from "./contract";

type TimeBox = z.infer<typeof timeBoxPayloadSchema> & { virtual?: boolean };
type Block = z.infer<typeof dayPresetBlockPayloadSchema>;
type Schedule = z.infer<typeof dayPresetSchedulePayloadSchema>;

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function ranges(box: { start_time: string; end_time: string }) {
  const start = minutes(box.start_time);
  const end = minutes(box.end_time);
  return end > start ? [[start, end]] : [[start, 1440], [0, end]];
}

function overlaps(left: { start_time: string; end_time: string }, right: { start_time: string; end_time: string }) {
  return ranges(left).some(([start, end]) => ranges(right).some(([otherStart, otherEnd]) => start < otherEnd && otherStart < end));
}

export function scheduleApplies(schedule: Schedule, date: string) {
  if (!schedule.active || date < schedule.start_date) return false;
  if (schedule.frequency === "once") return date === schedule.start_date;
  if (schedule.frequency === "daily") return true;
  const weekdays = JSON.parse(schedule.weekdays_json) as number[];
  return weekdays.includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
}

export function resolveLifeFlowDay(date: string, stored: TimeBox[], blocks: Block[], schedules: Schedule[]) {
  const storedForDate = stored.filter((box) => box.date === date);
  const snapshots = new Set(storedForDate.map((box) => box.id));
  const effective = storedForDate.filter((box) => box.dismissed === 0);
  const blocksByPreset = new Map<string, Block[]>();
  for (const block of blocks) blocksByPreset.set(block.preset_id, [...(blocksByPreset.get(block.preset_id) ?? []), block]);

  for (const schedule of schedules) {
    if (!scheduleApplies(schedule, date)) continue;
    for (const block of (blocksByPreset.get(schedule.preset_id) ?? []).sort((a, b) => a.sort_order - b.sort_order)) {
      const id = `time-box-${schedule.id}-${block.id}-${date}`;
      if (snapshots.has(id)) continue;
      const candidate: TimeBox = {
        id, date, title: block.title, start_time: block.start_time, end_time: block.end_time,
        break_durations_json: block.break_durations_json, color: block.color, completed: 0,
        created_at: `${date}T00:00:00.000Z`, dismissed: 0, habit_id: null,
        preset_schedule_id: schedule.id, preset_block_id: block.id, virtual: true,
      };
      const conflict = effective.some((box) => overlaps(box, candidate) || (candidate.color !== null && box.color === candidate.color));
      if (!conflict) effective.push(candidate);
    }
  }
  return effective.sort((left, right) => left.start_time.localeCompare(right.start_time) || left.id.localeCompare(right.id));
}
