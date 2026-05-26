"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CalculatorIcon,
  MoneyReceiveIcon,
  MoneySendIcon,
  Wallet01Icon,
  Calendar03Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ShoppingBagIcon,
  CalendarAdd01Icon,
} from "@hugeicons/core-free-icons";
import type { CashflowSummary } from "@/lib/notion";
import { Badge } from "@/components/ui/badge";

export type StatsData = Pick<
  CashflowSummary,
  "totalEntries"
  | "totalIncome"
  | "totalExpenses"
  | "balance"
> & {
  currentWeek?: CashflowSummary["currentWeek"];
  currentMonth?: CashflowSummary["currentMonth"];
  topExpenseCategories?: CashflowSummary["topExpenseCategories"];
  weeklyBreakdown?: CashflowSummary["weeklyBreakdown"];
};

interface StatsProps {
  stats: StatsData;
}

export function Stats({ stats }: StatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasDetailedStats = stats.currentWeek && stats.currentMonth && stats.topExpenseCategories;

  const formatCurrencyCompact = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      notation: "compact",
      compactDisplay: "short",
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-3 mb-4">
      <div className="relative">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <HugeiconsIcon
                icon={CalculatorIcon}
                size={16}
                className="text-muted-foreground sm:w-5 sm:h-5"
              />
              <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                Entries
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold">{stats.totalEntries}</div>
          </div>
          <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <HugeiconsIcon
                icon={MoneyReceiveIcon}
                size={16}
                className="text-green-600 sm:w-5 sm:h-5"
              />
              <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                Income
              </div>
            </div>
            <div
              className="text-base sm:text-2xl font-bold text-green-600 truncate"
              title={formatCurrencyFull(stats.totalIncome)}
            >
              {formatCurrencyCompact(stats.totalIncome)}
            </div>
          </div>
          <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <HugeiconsIcon
                icon={MoneySendIcon}
                size={16}
                className="text-red-600 sm:w-5 sm:h-5"
              />
              <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                Expenses
              </div>
            </div>
            <div
              className="text-base sm:text-2xl font-bold text-red-600 truncate"
              title={formatCurrencyFull(stats.totalExpenses)}
            >
              {formatCurrencyCompact(stats.totalExpenses)}
            </div>
          </div>
          <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <HugeiconsIcon
                icon={Wallet01Icon}
                size={16}
                className={`sm:w-5 sm:h-5 ${
                  stats.balance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              />
              <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                Balance
              </div>
            </div>
            <div
              className={`text-base sm:text-2xl font-bold truncate ${
                stats.balance >= 0 ? "text-green-600" : "text-red-600"
              }`}
              title={formatCurrencyFull(stats.balance)}
            >
              {formatCurrencyCompact(stats.balance)}
            </div>
          </div>
        </div>

        {hasDetailedStats && (
          <Badge
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute -top-6 right-0 cursor-pointer select-none gap-0.5"
            variant="ghost"
          >
            {isExpanded ? "Hide" : "More"}
            <HugeiconsIcon
              icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
              size={12}
            />
          </Badge>
        )}
      </div>

      {isExpanded && hasDetailedStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="rounded-lg border p-3 sm:p-4 shadow-sm bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon
                icon={CalendarAdd01Icon}
                size={18}
                className="text-primary"
              />
              <div className="text-sm font-semibold">Current Week</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Week</span>
                <span className="text-sm font-medium">
                  {stats.currentWeek!.weekNumber} of {stats.currentMonth!.monthName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Period</span>
                <span className="text-xs">
                  {formatDateShort(stats.currentWeek!.weekStart)} -{" "}
                  {formatDateShort(stats.currentWeek!.weekEnd)}
                </span>
              </div>
              <div className="pt-2 border-t space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Income</span>
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrencyCompact(stats.currentWeek!.income)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Expenses</span>
                  <span className="text-sm font-medium text-red-600">
                    {formatCurrencyCompact(stats.currentWeek!.expenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 sm:p-4 shadow-sm bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={18}
                className="text-primary"
              />
              <div className="text-sm font-semibold">
                {stats.currentMonth!.monthName} {stats.currentMonth!.year}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Income</span>
                <span className="text-sm font-medium text-green-600">
                  {formatCurrencyCompact(stats.currentMonth!.income)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Expenses</span>
                <span className="text-sm font-medium text-red-600">
                  {formatCurrencyCompact(stats.currentMonth!.expenses)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-muted-foreground">Net</span>
                <span
                  className={`text-sm font-bold ${
                    stats.currentMonth!.income - stats.currentMonth!.expenses >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrencyCompact(
                    stats.currentMonth!.income - stats.currentMonth!.expenses
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 sm:p-4 shadow-sm bg-muted/30 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon
                icon={ShoppingBagIcon}
                size={18}
                className="text-primary"
              />
              <div className="text-sm font-semibold">Top Expenses</div>
            </div>
            <div className="space-y-2">
              {stats.topExpenseCategories!.length > 0 ? (
                stats.topExpenseCategories!.map((cat, index) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground truncate flex-1 mr-2">
                        {index + 1}. {cat.category}
                      </span>
                      <span className="text-xs font-medium">
                        {formatCurrencyCompact(cat.total)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/70 rounded-full transition-all"
                        style={{
                          width: `${Math.min(cat.percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground text-center py-2">
                  No expense data
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}