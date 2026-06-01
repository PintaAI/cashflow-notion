"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoneyReceiveIcon,
  MoneySendIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ShoppingBagIcon,
  CalendarAdd01Icon,
  Calendar03Icon,
  EyeIcon,
  EyeOff,
} from "@hugeicons/core-free-icons";
import type { CashflowSummary } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/components/providers/currency-provider";

export type StatsData = Pick<
  CashflowSummary,
  "totalEntries" | "totalIncome" | "totalExpenses" | "balance"
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
  const [showBalance, setShowBalance] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const { format } = useCurrency();

  const hasDetailedStats =
    stats.currentWeek && stats.currentMonth && stats.topExpenseCategories;

  const formatCurrencyCompact = (value: number) => format(value, { compact: true });
  const formatCurrencyFull = (value: number) => format(value);

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-3 mb-4">
      <div>
        <div className="py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground tracking-wide uppercase">
                Balance
              </span>
              <button
                type="button"
                onClick={() => setShowBalance(!showBalance)}
                className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <HugeiconsIcon
                  icon={showBalance ? EyeIcon : EyeOff}
                  size={16}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={MoneyReceiveIcon}
                size={14}
                className="text-green-600"
              />
              <span className="hidden sm:inline">Income</span>
              <span className="font-medium text-green-600">
                {showBalance ? formatCurrencyCompact(stats.totalIncome) : "••••"}
              </span>
              <span className="text-muted-foreground/40 mx-0.5">|</span>
              <HugeiconsIcon
                icon={MoneySendIcon}
                size={14}
                className="text-red-600"
              />
              <span className="hidden sm:inline">Expense</span>
              <span className="font-medium text-red-600">
                {showBalance ? formatCurrencyCompact(stats.totalExpenses) : "••••"}
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div
              className={`text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight transition-all ${
                stats.balance < 0 ? "text-red-600" : ""
              }`}
              title={formatCurrencyFull(stats.balance)}
            >
              {showBalance ? formatCurrencyCompact(stats.balance) : "••••••"}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground/50">
                <span className="font-medium text-muted-foreground/70">{stats.totalEntries}</span>{" "}
                entries
              </div>
              {hasDetailedStats && (
                <Badge
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="cursor-pointer select-none gap-0.5 shrink-0"
                  variant="secondary"
                >
                  {isExpanded ? "Hide" : "More"}
                  <HugeiconsIcon
                    icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                    size={12}
                  />
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && hasDetailedStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={CalendarAdd01Icon}
                size={18}
                className="text-muted-foreground"
              />
              <div className="text-sm font-semibold">Current Week</div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Week {stats.currentWeek!.weekNumber} of{" "}
                {stats.currentMonth!.monthName}
              </span>
              <span className="text-muted-foreground/30">&bull;</span>
              <span>
                {formatDateShort(stats.currentWeek!.weekStart)} -{" "}
                {formatDateShort(stats.currentWeek!.weekEnd)}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm font-medium text-green-600">
                {showBalance ? formatCurrencyCompact(stats.currentWeek!.income) : "••••"}
              </span>
              <span className="text-sm font-medium text-red-600">
                {showBalance ? formatCurrencyCompact(stats.currentWeek!.expenses) : "••••"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={18}
                className="text-muted-foreground"
              />
              <div className="text-sm font-semibold">
                {stats.currentMonth!.monthName} {stats.currentMonth!.year}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm font-medium text-green-600">
                {showBalance ? formatCurrencyCompact(stats.currentMonth!.income) : "••••"}
              </span>
              <span className="text-sm font-medium text-red-600">
                {showBalance ? formatCurrencyCompact(stats.currentMonth!.expenses) : "••••"}
              </span>
              <span className="text-xs text-muted-foreground">Net</span>
              <span
                className={`text-sm font-bold ${
                  stats.currentMonth!.income - stats.currentMonth!.expenses < 0
                    ? "text-red-600"
                    : ""
                }`}
              >
                {showBalance
                  ? formatCurrencyCompact(
                      stats.currentMonth!.income - stats.currentMonth!.expenses,
                    )
                  : "••••"}
              </span>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={ShoppingBagIcon}
                size={18}
                className="text-muted-foreground"
              />
              <div className="text-sm font-semibold">Top Expenses</div>
            </div>
            {stats.topExpenseCategories!.length > 0 ? (
              stats.topExpenseCategories!.map((cat, index) => (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground truncate flex-1 mr-2">
                      {index + 1}. {cat.category}
                    </span>
                    <span className="text-xs font-medium">
                      {showBalance ? formatCurrencyCompact(cat.total) : "••••"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500/70 rounded-full transition-all"
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground py-2">
                No expense data
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
