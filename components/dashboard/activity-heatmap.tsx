"use client";

import { useRef, useEffect, useState } from "react";
import type { ActivityOverview } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
  activity: ActivityOverview;
}

const DAY_LABELS = ["Sen", "", "Rab", "", "Jum", "", ""];
const DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

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
      return "bg-emerald-200 dark:bg-emerald-950";
    case 2:
      return "bg-emerald-400 dark:bg-emerald-800";
    case 3:
      return "bg-emerald-600 dark:bg-emerald-600";
    case 4:
      return "bg-emerald-800 dark:bg-emerald-400";
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

function getCurrentWeekDays(days: ActivityOverview["days"]): ActivityOverview["days"] {
  const today = new Date();
  const todayDow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - todayDow);

  const dayMap = new Map(days.map((d) => [d.date, d]));

  const week: ActivityOverview["days"] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    week.push(dayMap.get(key) || { date: key, count: 0 });
  }
  return week;
}

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const [view, setView] = useState<"grid" | "calendar">(getStoredView);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayKey = getLocalTodayKey();
  const todayDOW = (new Date().getDay() + 6) % 7;
  const hasLoggedToday = Boolean(activity.days.at(-1)?.count);

  useEffect(() => {
    if (scrollRef.current && view === "grid") {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [view]);

  function handleViewChange(v: "grid" | "calendar") {
    setView(v);
    storeView(v);
  }

  const calendarDays = getCurrentWeekDays(activity.days);

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
            <div className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
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
        <div ref={scrollRef} className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex shrink-0 flex-col gap-1 text-[10px] text-muted-foreground">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="h-3 leading-none sm:h-3.5">{label}</span>
            ))}
          </div>
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {activity.days.map((day) => (
              <div
                key={day.date}
                title={formatDayTitle(day)}
                aria-label={formatDayTitle(day)}
                className={cn(
                  "size-3 rounded-[3px] ring-1 ring-border/30 transition-transform hover:scale-125 sm:size-3.5",
                  getCellClass(day.count)
                )}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="mb-1 grid grid-cols-7 gap-1">
              {DAY_HEADERS.map((d, i) => (
                <div key={i} className={cn("text-center text-[10px] font-medium", i === todayDOW ? "text-foreground font-bold underline underline-offset-2" : i === 5 ? "text-muted-foreground/50" : i === 6 ? "text-red-400 dark:text-red-500" : "text-muted-foreground")}>{d}</div>
              ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => (
              <div
                key={day.date}
                title={formatDayTitle(day)}
                aria-label={formatDayTitle(day)}
                className={cn(
                  "flex items-center justify-center rounded-[3px] text-[11px] font-medium h-7 transition-transform hover:scale-125",
                  day.date === todayKey ? "ring-2 ring-primary" : "ring-1 ring-border/30",
                  day.count > 0 ? "text-emerald-950 dark:text-emerald-50" : "text-muted-foreground",
                  getCellClass(day.count)
                )}
              >
                {getDayNumber(day.date)}
              </div>
            ))}
          </div>
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
