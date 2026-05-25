"use client";

import { useRef, useEffect } from "react";
import type { ActivityOverview } from "@/app/actions/analytics";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
  activity: ActivityOverview;
}

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

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

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = activity.days.at(-1);
  const hasLoggedToday = Boolean(today?.count);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  return (
    <section className="mb-4 rounded-lg border bg-card p-3 shadow-sm sm:mb-6 sm:p-4">
      <div className="hidden sm:block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold sm:text-base">Activity</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {hasLoggedToday ? "Today logged. Keep it alive." : "Log today to light up the grid."}
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            {activity.currentStreak} day streak
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{activity.totalEntries} entries</span>
        <span>|</span>
        <span>{activity.activeDays} active days</span>
      </div>

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
                "size-3 rounded-[3px] ring-1 ring-border/60 transition-transform hover:scale-125 sm:size-3.5",
                getCellClass(day.count)
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 4, 6].map((count) => (
          <span key={count} className={cn("size-2.5 rounded-[2px] ring-1 ring-border/60", getCellClass(count))} />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}
