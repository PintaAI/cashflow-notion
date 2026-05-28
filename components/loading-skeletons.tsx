import {
  CalculatorIcon,
  MoneyReceiveIcon,
  MoneySendIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Skeleton } from "@/components/ui/skeleton";

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 mb-4 sm:mb-6">
      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={CalculatorIcon}
            size={16}
            className="text-muted-foreground sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Entries</div>
        </div>
        <Skeleton className="h-6 sm:h-8 w-12 sm:w-16 mt-2" />
      </div>

      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={MoneyReceiveIcon}
            size={16}
            className="text-green-600 sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Income</div>
        </div>
        <Skeleton className="h-6 sm:h-8 w-20 sm:w-28 mt-2" />
      </div>

      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={MoneySendIcon}
            size={16}
            className="text-red-600 sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Expenses</div>
        </div>
        <Skeleton className="h-6 sm:h-8 w-20 sm:w-28 mt-2" />
      </div>

      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={Wallet01Icon}
            size={16}
            className="text-muted-foreground sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</div>
        </div>
        <Skeleton className="h-6 sm:h-8 w-20 sm:w-28 mt-2" />
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

      <div className="rounded-lg border p-3 sm:p-4 mb-4 sm:mb-6">
        <Skeleton className="h-6 w-20 mb-3 sm:mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5 sm:space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 sm:h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3 sm:mt-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 mb-4 sm:mb-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3 sm:p-4">
            <Skeleton className="h-6 w-36 mb-3 sm:mb-4" />
            <Skeleton className="h-[250px] sm:h-[300px] w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3 sm:p-4 mb-4 sm:mb-6">
        <Skeleton className="h-6 w-32 mb-3 sm:mb-4" />
        <Skeleton className="h-[250px] sm:h-[300px] w-full" />
      </div>

      <div className="rounded-lg border p-3 sm:p-4">
        <Skeleton className="h-6 w-40 mb-3 sm:mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}
