"use client";

import { useRef, useEffect, useState } from "react";
import type { ActivityOverview } from "@/lib/analytics";
import { parseDateKey, toDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
  activity: ActivityOverview;
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

const DAY_LABELS = ["Sen", "", "Rab", "", "Jum", "", ""];

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function getCellClass(count: number): string {
  switch (getLevel(count)) {
    case 1:
      return "bg-primary/20";
    case 2:
      return "bg-primary/40";
    case 3:
      return "bg-primary/70";
    case 4:
      return "bg-primary";
    default:
      return "bg-muted";
  }
}

function formatDayTitle(day: ActivityOverview["days"][number]): string {
  const formattedDate = new Date(`${day.date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (day.count === 0) {
    return `${formattedDate}: belum ada transaksi`;
  }

  return `${formattedDate}: ${day.count} transaksi`;
}

const VIEW_STORAGE_KEY = "cashflow_activity_view";

function getStoredView(): "grid" | "calendar" {
  if (typeof window === "undefined") return "grid";
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "calendar") return stored;
  } catch { /* ignore */ }
  return "grid";
}

function storeView(view: "grid" | "calendar") {
  try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
}

function getDayNumber(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDate();
}

function getLocalTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthRangeDays(days: ActivityOverview["days"], selectedDate: string): ActivityOverview["days"] {
  const selected = parseDateKey(selectedDate);
  const today = new Date();
  const firstOfMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const lastOfMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const endDate = selected.getFullYear() === today.getFullYear() && selected.getMonth() === today.getMonth()
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)
    : lastOfMonth;

  const dayMap = new Map(days.map((d) => [d.date, d]));

  const range: ActivityOverview["days"] = [];
  const cursor = new Date(firstOfMonth);
  while (cursor <= endDate) {
    const key = toDateKey(cursor);
    range.push(dayMap.get(key) || { date: key, count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return range;
}

export function ActivityHeatmap({ activity, selectedDate, onDateSelect }: ActivityHeatmapProps) {
  const [view, setView] = useState<"grid" | "calendar">(getStoredView);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const todayKey = getLocalTodayKey();
  const hasLoggedToday = activity.currentStreak > 0;
  const scrollKey = `${view}:${selectedDate}`;

  useEffect(() => {
    if (gridScrollRef.current && scrollKey.startsWith("grid:")) {
      requestAnimationFrame(() => {
        const selectedEl = gridScrollRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null;
        const container = gridScrollRef.current!;
        if (selectedEl) {
          const scrollTo = selectedEl.offsetLeft - container.clientWidth / 2 + selectedEl.clientWidth / 2;
          container.scrollLeft = Math.max(0, scrollTo);
          return;
        }
        container.scrollLeft = container.scrollWidth;
      });
    }
  }, [scrollKey]);

  useEffect(() => {
    if (calendarScrollRef.current && scrollKey.startsWith("calendar:")) {
      requestAnimationFrame(() => {
        const selectedEl = calendarScrollRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null;
        if (selectedEl) {
          const container = calendarScrollRef.current!;
          const scrollTo = selectedEl.offsetLeft - container.clientWidth / 2 + selectedEl.clientWidth / 2;
          container.scrollLeft = Math.max(0, scrollTo);
        }
      });
    }
  }, [scrollKey]);

  function handleViewChange(v: "grid" | "calendar") {
    setView(v);
    storeView(v);
  }

  const calendarDays = getMonthRangeDays(activity.days, selectedDate);

  return (
    <section className="mb-4 sm:mb-6">
      <div className="hidden sm:block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold sm:text-base">Activity</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {hasLoggedToday ? "Today logged. Keep it alive." : "Log today to light up the grid."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => handleViewChange("grid")}
                className={cn(
                  "px-2 py-1 text-xs font-medium transition-colors",
                  view === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"
                )}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => handleViewChange("calendar")}
                className={cn(
                  "px-2 py-1 text-xs font-medium transition-colors",
                  view === "calendar" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"
                )}
              >
                Calendar
              </button>
            </div>
            <div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {activity.currentStreak} day streak
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{activity.totalEntries} tercatat</span>
        <span>|</span>
        <span>{activity.activeDays} active days</span>
        <span className="ml-auto sm:hidden">
          <div className="flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => handleViewChange("grid")}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                view === "grid" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
              )}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("calendar")}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                view === "calendar" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
              )}
            >
              Calendar
            </button>
          </div>
        </span>
      </div>

      {view === "grid" ? (
        <div ref={gridScrollRef} className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex shrink-0 flex-col gap-1 text-[10px] text-muted-foreground">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="h-3 leading-none sm:h-3.5">{label}</span>
            ))}
          </div>
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {activity.days.map((day) => {
              const isSelected = day.date === selectedDate;

              return (
                <button
                  key={day.date}
                  type="button"
                  data-selected={isSelected ? "true" : undefined}
                  onClick={() => onDateSelect(day.date)}
                  title={formatDayTitle(day)}
                  aria-label={formatDayTitle(day)}
                  className={cn(
                    "size-3 rounded-[3px] p-0 ring-1 ring-border/30 transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-3.5",
                    isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    getCellClass(day.count)
                  )}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div ref={calendarScrollRef} className="mt-3 flex gap-1 overflow-x-auto pb-1 no-scrollbar">
            {calendarDays.map((day) => {
              const d = new Date(`${day.date}T00:00:00`);
              const dowShort = d.toLocaleDateString("id-ID", { weekday: "short" });
              const isToday = day.date === todayKey;
              const isSelected = day.date === selectedDate;
              const isPast = day.date < todayKey;
              return (
                <div key={day.date} data-selected={isSelected ? "true" : undefined} className="flex shrink-0 flex-col items-center gap-0.5">
                  <span className={cn(
                    "text-[9px] font-medium",
                    isSelected ? "text-primary" : isToday ? "text-foreground" : isPast ? "text-muted-foreground" : "text-muted-foreground/50",
                  )}>
                    {dowShort}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDateSelect(day.date)}
                    title={formatDayTitle(day)}
                    aria-label={formatDayTitle(day)}
                    className={cn(
                      "flex h-8 w-11 items-center justify-center rounded-[3px] p-0 text-xs font-semibold transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : isToday ? "ring-2 ring-foreground/60" : "ring-1 ring-border/30",
                      day.count > 0 ? "text-primary-foreground" : "text-muted-foreground",
                      getCellClass(day.count)
                    )}
                  >
                    {getDayNumber(day.date)}
                  </button>
                </div>
              );
            })}
          </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 4, 6].map((count) => (
          <span key={count} className={cn("size-2.5 rounded-[2px] ring-1 ring-border/30", getCellClass(count))} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
