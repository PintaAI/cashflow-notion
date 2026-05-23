import { Skeleton } from "@/components/ui/skeleton";
import { Analytics01Icon, CalculatorIcon, MoneyReceiveIcon, MoneySendIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function AnalyticsLoading() {
  return (
    <main className="container mx-auto py-4 sm:py-8 px-4 pb-24">
      {/* Header */}
      <div className="mb-4 rounded-lg border border-l-4 border-l-primary bg-primary/5 px-4 py-3 shadow-sm sm:mb-6 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs sm:size-9">
            <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2.2} className="size-4.5 sm:size-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Analytics</h1>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 mb-4 sm:mb-6">
        {/* Entry Count Card */}
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

        {/* Income Card */}
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

        {/* Expenses Card */}
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

        {/* Balance Card */}
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

      {/* Filters Skeleton */}
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

      {/* Charts Skeleton */}
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
    </main>
  );
}
