import {
  Audit01Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  MoneyReceiveIcon,
  MoneySendIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsSkeleton() {
  return (
    <div className="space-y-3 mb-4">
      <div>
        <div className="py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground tracking-wide uppercase">
                Balance
              </span>
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={MoneyReceiveIcon}
                size={14}
                className="text-green-600"
              />
              <span className="hidden sm:inline">Income</span>
              <Skeleton className="h-4 w-10" />
              <span className="text-muted-foreground/40 mx-0.5">|</span>
              <HugeiconsIcon
                icon={MoneySendIcon}
                size={14}
                className="text-red-600"
              />
              <span className="hidden sm:inline">Expense</span>
              <Skeleton className="h-4 w-10" />
            </div>
          </div>

          <div className="flex items-end justify-between">
            <Skeleton className="h-7 sm:h-8 md:h-9 w-28 sm:w-36" />
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground/50">
                <Skeleton className="h-4 w-8 inline-block align-middle" />{" "}
                <span>entries</span>
              </div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivityHeatmapSkeleton() {
  return (
    <section className="mb-4 sm:mb-6">
      <div className="hidden sm:block">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold sm:text-base">Activity</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">Log today to light up the grid.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <Skeleton className="h-3 w-4 bg-emerald-200 dark:bg-emerald-800" />
            <span>day streak</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Skeleton className="h-3 w-6" />
          entries
        </span>
        <span>|</span>
        <span className="inline-flex items-center gap-1">
          <Skeleton className="h-3 w-6" />
          active days
        </span>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
          {Array.from({ length: 182 }).map((_, i) => (
            <Skeleton key={i} className="size-3 rounded-[3px] sm:size-3.5" />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        <span className="size-2.5 rounded-[2px] bg-muted ring-1 ring-border/30" />
        <span className="size-2.5 rounded-[2px] bg-emerald-200 ring-1 ring-border/30 dark:bg-emerald-950" />
        <span className="size-2.5 rounded-[2px] bg-emerald-400 ring-1 ring-border/30 dark:bg-emerald-800" />
        <span className="size-2.5 rounded-[2px] bg-emerald-600 ring-1 ring-border/30 dark:bg-emerald-600" />
        <span className="size-2.5 rounded-[2px] bg-emerald-800 ring-1 ring-border/30 dark:bg-emerald-400" />
        <span>More</span>
      </div>
    </section>
  );
}

export function CashflowTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-10 shrink-0" />
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="grid grid-cols-[1fr_0.8fr_0.8fr_0.7fr_0.5fr] gap-4 border-b p-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20 justify-self-end" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr_0.8fr_0.8fr_0.7fr_0.5fr] gap-4 border-b p-2 last:border-b-0">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24 justify-self-end" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsContentSkeleton() {
  return (
    <>
      <StatsSkeleton />

      <div className="mt-4">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" disabled>
            <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="size-4" />
          </Button>
          <div className="flex justify-center">
            <Skeleton className="h-5 w-32 sm:w-40" />
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" disabled>
            <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <h2 className="text-base font-semibold sm:text-lg">Filters</h2>
        <Skeleton className="h-9 w-36 rounded-md sm:w-48" />
      </div>

      <div className="mb-4 rounded-lg border p-3 sm:mb-6 sm:p-4">
        <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Monthly Trend</h2>
        <div className="flex h-[250px] w-full items-end gap-2 rounded-md sm:h-[300px]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex h-full flex-1 items-end gap-1">
              <Skeleton className="w-full rounded-t" style={{ height: `${34 + ((i * 17) % 54)}%` }} />
              <Skeleton className="w-full rounded-t" style={{ height: `${28 + ((i * 23) % 58)}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <h2 className="text-base font-semibold sm:text-lg">Category</h2>
          <div className="flex w-fit items-center rounded-lg border p-0.5">
            <button
              type="button"
              disabled
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Breakdown
            </button>
            <button
              type="button"
              disabled
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              Details
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] lg:items-center">
          <div className="mx-auto flex h-[220px] w-full max-w-[280px] items-center justify-center sm:h-[260px] lg:h-[320px] lg:max-w-none">
            <Skeleton className="size-[176px] rounded-full sm:size-[210px] lg:size-[250px]" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex min-w-0 items-center gap-1.5">
                <Skeleton className="size-2 shrink-0 rounded-full" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="hidden h-3 w-12 lg:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function AuditStatusSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={Audit01Icon}
          strokeWidth={2}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}
