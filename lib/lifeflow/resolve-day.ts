import type { HabitLogPayload, ItemExceptionPayload, ItemPayload } from "./contract";

export type ItemOccurrence = {
  id: string; itemId: string; originalDate: string; date: string; kind: "habit" | "event";
  name: string; color: string; startTime: string | null; endTime: string | null;
  breakDurations: number[]; completed: boolean; overridden: boolean;
};

const DAY = 86_400_000;
const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function parts(value: string) { const [year, month, day] = value.split("-").map(Number); return { year, month, day, utc: Date.UTC(year, month - 1, day) }; }
function addDays(value: string, amount: number) { const date = new Date(parts(value).utc + amount * DAY); return date.toISOString().slice(0, 10); }
function monday(value: string) { const day = new Date(parts(value).utc).getUTCDay(); return addDays(value, -(day === 0 ? 6 : day - 1)); }

export function recurrenceApplies(item: ItemPayload, date: string) {
  if (date < item.starts_on || (item.recurrence_ends_on && date > item.recurrence_ends_on)) return false;
  if (!item.recurrence_frequency) return date === item.starts_on;
  const anchor = parts(item.starts_on), candidate = parts(date), interval = item.recurrence_interval;
  if (item.recurrence_frequency === "daily") return (candidate.utc - anchor.utc) / DAY % interval === 0;
  if (item.recurrence_frequency === "weekly") {
    const weeks = (parts(monday(date)).utc - parts(monday(item.starts_on)).utc) / DAY / 7;
    return weeks % interval === 0 && (JSON.parse(item.recurrence_weekdays_json) as string[]).includes(weekdays[new Date(candidate.utc).getUTCDay()]);
  }
  if (item.recurrence_frequency === "monthly") return candidate.day === anchor.day && ((candidate.year - anchor.year) * 12 + candidate.month - anchor.month) % interval === 0;
  return candidate.month === anchor.month && candidate.day === anchor.day && (candidate.year - anchor.year) % interval === 0;
}

export function resolveItemOccurrences(startDate: string, days: number, items: ItemPayload[], exceptions: ItemExceptionPayload[], logs: HabitLogPayload[]) {
  if (!Number.isInteger(days) || days < 0 || days > 3660) throw new Error("days must be an integer between 0 and 3660");
  const endDate = days ? addDays(startDate, days - 1) : startDate;
  const exceptionByOriginal = new Map(exceptions.map((value) => [`${value.item_id}|${value.original_date}`, value]));
  const logsByDate = new Set(logs.map((value) => `${value.item_id}|${value.date}`));
  const result: ItemOccurrence[] = [];
  const emit = (item: ItemPayload, originalDate: string, date: string, exception?: ItemExceptionPayload) => {
    const snapshot = exception?.replacement;
    result.push({ id: `${item.id}|${originalDate}`, itemId: item.id, originalDate, date, kind: item.kind,
      name: snapshot?.name ?? item.name, color: snapshot?.color ?? item.color,
      startTime: snapshot?.start_time ?? item.start_time, endTime: snapshot?.end_time ?? item.end_time,
      breakDurations: JSON.parse(snapshot?.break_durations_json ?? item.break_durations_json),
      completed: item.kind === "habit" && logsByDate.has(`${item.id}|${originalDate}`), overridden: Boolean(exception) });
  };
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(startDate, offset);
    for (const item of items) {
      if (!recurrenceApplies(item, date)) continue;
      const exception = item.kind === "event" && item.recurrence_frequency ? exceptionByOriginal.get(`${item.id}|${date}`) : undefined;
      if (!exception?.cancelled && !exception?.replacement) emit(item, date, date);
      else if (exception && !exception.cancelled && exception.replacement_date === date) emit(item, date, date, exception);
    }
  }
  for (const exception of exceptions) {
    if (exception.cancelled || !exception.replacement_date || exception.replacement_date < startDate || exception.replacement_date > endDate || exception.replacement_date === exception.original_date) continue;
    const item = items.find((candidate) => candidate.id === exception.item_id);
    if (item) emit(item, exception.original_date, exception.replacement_date, exception);
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || Number(a.startTime !== null) - Number(b.startTime !== null) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.itemId.localeCompare(b.itemId));
}

export function resolveLifeFlowDay(date: string, items: ItemPayload[], exceptions: ItemExceptionPayload[], logs: HabitLogPayload[]) {
  return resolveItemOccurrences(date, 1, items, exceptions, logs);
}
