"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeftIcon, ArrowRightIcon } from "@hugeicons/core-free-icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts";

import { Stats } from "@/components/stats";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { AnalyticsFilter } from "@/components/analytics-filter";
import { AnalyticsContentSkeleton } from "@/components/loading-skeletons";
import { useAnalytics, useCategories } from "@/hooks/use-cashflow-data";
import type { AnalyticsData } from "@/lib/analytics";
import type { IOType, CategoryType } from "@/lib/db";
import { useCurrency } from "@/components/providers/currency-provider";
import { formatCurrencyAmount } from "@/lib/currency";
import { cn } from "@/lib/utils";

// Color palette for charts - using oklch values directly for better color support
const COLORS = [
  "oklch(0.657 0.199 145.801)",  // Green - Income
  "oklch(0.577 0.245 27.325)",   // Red - Expenses
  "oklch(0.681 0.162 75.834)",   // Yellow - Net
  "oklch(0.623 0.214 259.814)",  // Blue
  "oklch(0.702 0.183 192.177)",  // Cyan
  "oklch(0.705 0.213 47.604)",   // Orange
  "oklch(0.606 0.218 332.348)",  // Pink
  "oklch(0.696 0.17 162.48)",    // Teal
  "oklch(0.663 0.171 264.053)",  // Purple
  "oklch(0.554 0.135 66.442)",   // Brown
  "oklch(0.476 0.114 61.907)",   // Dark brown
  "oklch(0.696 0.17 200.5)",     // Teal variant
];

const CATEGORY_CHART_COLORS: Record<string, string> = {
  default: "#64748b",
  gray: "#6b7280",
  brown: "#b45309",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  red: "#ef4444",
};

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthFilters(date: Date): Pick<AnalyticsChartsProps["filters"], "from" | "to"> {
  return {
    from: toDateKey(startOfMonth(date)),
    to: toDateKey(endOfMonth(date)),
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isWholeMonth(from: Date, to: Date): boolean {
  return toDateKey(from) === toDateKey(startOfMonth(from)) && toDateKey(to) === toDateKey(endOfMonth(from));
}

function getPeriodLabel(filters: AnalyticsChartsProps["filters"]): string {
  if (filters.allTime) return "All time";
  if (!filters.from || !filters.to) return "This month";

  const from = parseDateKey(filters.from);
  const to = parseDateKey(filters.to);

  if (isWholeMonth(from, to)) {
    return from.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  }

  return `${formatDate(from)} - ${formatDate(to)}`;
}

function getCategoryChartColor(categoryColor: string | undefined, fallback: string): string {
  if (!categoryColor) return fallback;
  if (categoryColor.startsWith("#") || categoryColor.startsWith("oklch") || categoryColor.startsWith("rgb")) {
    return categoryColor;
  }
  return CATEGORY_CHART_COLORS[categoryColor] ?? fallback;
}

const chartConfig = {
  income: {
    label: "Income",
    color: "oklch(0.657 0.199 145.801)", // Green
  },
  expenses: {
    label: "Expenses",
    color: "oklch(0.577 0.245 27.325)", // Red
  },
  net: {
    label: "Net",
    color: "oklch(0.681 0.162 75.834)", // Yellow
  },
} satisfies ChartConfig;

interface AnalyticsChartsProps {
  analytics: AnalyticsData;
  filters: {
    from?: string;
    to?: string;
    allTime?: boolean;
    io?: IOType;
    category?: CategoryType;
  };
  categories: string[];
}

const defaultFilters: AnalyticsChartsProps["filters"] = getMonthFilters(new Date());

export function AnalyticsCharts() {
  const [filters, setFilters] = React.useState<AnalyticsChartsProps["filters"]>(defaultFilters);
  const analyticsQuery = useAnalytics(filters);
  const categoriesQuery = useCategories();

  if (analyticsQuery.isLoading || categoriesQuery.isLoading) {
    return <AnalyticsContentSkeleton />;
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        Analytics data is temporarily unavailable. Please try again shortly.
      </div>
    );
  }

  return (
    <AnalyticsChartsContent
      analytics={analyticsQuery.data}
      filters={filters}
      categories={categoriesQuery.data ?? []}
      onFiltersChange={setFilters}
    />
  );
}

function AppliedFilterPeriod({
  filters,
  onFiltersChange,
}: {
  filters: AnalyticsChartsProps["filters"];
  onFiltersChange: (filters: AnalyticsChartsProps["filters"]) => void;
}) {
  function moveMonth(delta: number) {
    const baseDate = filters.from ? parseDateKey(filters.from) : new Date();
    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1);
    const nextFilters: AnalyticsChartsProps["filters"] = {
      ...filters,
      ...getMonthFilters(nextMonth),
    };

    delete nextFilters.allTime;
    onFiltersChange(nextFilters);
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => moveMonth(-1)}>
          <HugeiconsIcon icon={ArrowLeftIcon} strokeWidth={2} className="size-4" />
        </Button>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-semibold capitalize sm:text-base">{getPeriodLabel(filters)}</p>
          {(filters.io || filters.category) && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
              {filters.io && <span>{filters.io}</span>}
              {filters.io && filters.category && <span>•</span>}
              {filters.category && <span>{filters.category}</span>}
            </div>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => moveMonth(1)}>
          <HugeiconsIcon icon={ArrowRightIcon} strokeWidth={2} className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AnalyticsChartsContent({
  analytics,
  filters,
  categories,
  onFiltersChange,
}: AnalyticsChartsProps & {
  onFiltersChange: (filters: AnalyticsChartsProps["filters"]) => void;
}) {
  const { currency } = useCurrency();
  const [categoryView, setCategoryView] = React.useState<"chart" | "details">("chart");

  // Prepare category data for pie chart
  const categoryChartData = React.useMemo(() => {
    return analytics.byCategory.map((item, index) => ({
      ...item,
      fill: getCategoryChartColor(item.color, COLORS[index % COLORS.length]),
    }));
  }, [analytics.byCategory]);

  // Create dynamic chart config for categories
  const dynamicCategoryChartConfig = React.useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    analytics.byCategory.forEach((item, index) => {
      config[item.category] = {
        label: item.category,
        color: getCategoryChartColor(item.color, COLORS[index % COLORS.length]),
      };
    });
    return config;
  }, [analytics.byCategory]);

  return (
    <>
      {/* Summary Cards */}
      <Stats
        stats={{
          totalEntries: analytics.summary.entryCount,
          totalIncome: analytics.summary.totalIncome,
          totalExpenses: analytics.summary.totalExpenses,
          balance: analytics.summary.balance,
        }}
      />

      <AppliedFilterPeriod filters={filters} onFiltersChange={onFiltersChange} />

      {/* Filter Row */}
      <div className="mt-4 mb-4 flex items-center justify-between gap-3 sm:mb-6">
        <h2 className="text-base font-semibold sm:text-lg">Filters</h2>
        <AnalyticsFilter filters={filters} categories={categories} onFiltersChange={onFiltersChange} />
      </div>

      {/* Monthly Trend Chart */}
      <div className="mb-4 rounded-lg border p-3 sm:mb-6 sm:p-4">
        <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Monthly Trend</h2>
        {analytics.byMonth.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full sm:h-[300px]">
            <BarChart data={analytics.byMonth} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 6)}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrencyAmount(value, currency, { compact: true })}
                className="text-xs"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="income"
                name="Income"
                fill="var(--color-income)"
                radius={4}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="var(--color-expenses)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground sm:h-[300px]">
            No data available for the selected filters
          </div>
        )}
      </div>

      {/* Category */}
      <div className="rounded-lg border p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <h2 className="text-base font-semibold sm:text-lg">Category</h2>
          <div className="flex w-fit items-center rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setCategoryView("chart")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                categoryView === "chart"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Breakdown
            </button>
            <button
              type="button"
              onClick={() => setCategoryView("details")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                categoryView === "details"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Details
            </button>
          </div>
        </div>

        {categoryView === "chart" ? (
          categoryChartData.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] lg:items-center">
              <ChartContainer
                config={dynamicCategoryChartConfig as ChartConfig}
                className="mx-auto h-[220px] w-full max-w-[280px] sm:h-[260px] lg:h-[320px] lg:max-w-none"
              >
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={96}
                    paddingAngle={2}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ChartContainer>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 lg:grid-cols-1">
                {categoryChartData.map((item) => (
                  <div key={item.category} className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.category}</span>
                    <span className="hidden text-muted-foreground lg:inline">
                      {formatCurrencyAmount(item.total, currency, { compact: true })}
                    </span>
                    <span className="hidden w-10 text-right text-muted-foreground lg:inline-block">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
              No category data available
            </div>
          )
        ) : analytics.byCategory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2 text-left text-xs sm:px-4 sm:text-sm">Category</th>
                  <th className="px-2 py-2 text-right text-xs sm:px-4 sm:text-sm">Total</th>
                  <th className="px-2 py-2 text-right text-xs sm:px-4 sm:text-sm">Count</th>
                  <th className="px-2 py-2 text-right text-xs sm:px-4 sm:text-sm">%</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byCategory.map((item, index) => (
                  <tr key={item.category} className="border-b last:border-b-0">
                    <td className="px-2 py-2 sm:px-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div
                          className="size-2 shrink-0 rounded-full sm:size-3"
                          style={{ backgroundColor: getCategoryChartColor(item.color, COLORS[index % COLORS.length]) }}
                        />
                        <span className="truncate text-xs sm:text-sm">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-medium sm:px-4 sm:text-sm">
                      {formatCurrencyAmount(item.total, currency, { compact: true })}
                    </td>
                    <td className="px-2 py-2 text-right text-xs sm:px-4 sm:text-sm">{item.count}</td>
                    <td className="px-2 py-2 text-right text-xs sm:px-4 sm:text-sm">{item.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No category data available
          </div>
        )}
      </div>

    </>
  );
}
