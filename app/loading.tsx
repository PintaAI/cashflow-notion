import { Skeleton } from "@/components/ui/skeleton";
import { Wallet01Icon, CalculatorIcon, MoneyReceiveIcon, MoneySendIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function Loading() {
  return (
    <main className="container mx-auto py-4 sm:py-8 px-4 pb-24">
      {/* Header */}
      <div className="mb-4 rounded-lg border border-l-4 border-l-primary bg-primary/5 px-4 py-3 shadow-sm sm:mb-6 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs sm:size-9">
            <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.2} className="size-4.5 sm:size-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Cashflow Tracker</h1>
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

      {/* Table Skeleton */}
      <div className="rounded-lg border">
        {/* Table Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-10 flex-1 max-w-sm" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Column Headers */}
        <div className="border-b bg-muted/30">
          <div className="flex gap-4 p-3 sm:p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20 hidden sm:block" />
          </div>
        </div>

        {/* Table Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3 sm:p-4 border-b last:border-b-0">
            <Skeleton className="h-5 w-32 sm:w-40" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20 hidden sm:block" />
          </div>
        ))}
      </div>
    </main>
  );
}
