"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Line,
  LineChart,
} from "recharts";

import { Stats } from "@/components/stats";
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
import type { AnalyticsData } from "@/app/actions/analytics";
import type { IOType, CategoryType } from "@/lib/db";

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

const defaultFilters: AnalyticsChartsProps["filters"] = {};

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

function AnalyticsChartsContent({
  analytics,
  filters,
  categories,
  onFiltersChange,
}: AnalyticsChartsProps & {
  onFiltersChange: (filters: AnalyticsChartsProps["filters"]) => void;
}) {
  // Prepare category data for pie chart
  const categoryChartData = React.useMemo(() => {
    return analytics.byCategory.map((item, index) => ({
      ...item,
      fill: COLORS[index % COLORS.length],
    }));
  }, [analytics.byCategory]);

  // Create dynamic chart config for categories
  const dynamicCategoryChartConfig = React.useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    analytics.byCategory.forEach((item, index) => {
      config[item.category] = {
        label: item.category,
        color: COLORS[index % COLORS.length],
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

      {/* Filter Section */}
      <div className="rounded-lg border mt-4 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Filters</h2>
          <AnalyticsFilter filters={filters} categories={categories} onFiltersChange={onFiltersChange} />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 mb-4 sm:mb-6">
        {/* Monthly Trend Chart */}
        <div className="rounded-lg border p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Monthly Trend</h2>
          {analytics.byMonth.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
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
                  tickFormatter={(value) => {
                    if (value >= 1000000) {
                      return `${(value / 1000000).toFixed(1)}M`;
                    }
                    if (value >= 1000) {
                      return `${(value / 1000).toFixed(0)}K`;
                    }
                    return value;
                  }}
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
            <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground text-sm">
              No data available for the selected filters
            </div>
          )}
        </div>

        {/* Category Breakdown Chart */}
        <div className="rounded-lg border p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Category Breakdown</h2>
          {categoryChartData.length > 0 ? (
            <ChartContainer
              config={dynamicCategoryChartConfig as ChartConfig}
              className="h-[250px] sm:h-[300px] w-full"
            >
              <PieChart>
                <Pie
                  data={categoryChartData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  className="sm:outerRadius-100"
                  label={({ payload }) => {
                    if (payload && 'category' in payload && 'percentage' in payload) {
                      return `${payload.category} (${payload.percentage.toFixed(1)}%)`;
                    }
                    return null;
                  }}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground text-sm">
              No category data available
            </div>
          )}
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className="rounded-lg border p-3 sm:p-4 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Daily Net Flow</h2>
        {analytics.byDay.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
            <LineChart data={analytics.byDay} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) {
                    return `${(value / 1000000).toFixed(1)}M`;
                  }
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(0)}K`;
                  }
                  return value;
                }}
                className="text-xs"
              />
              <ChartTooltip />
              <Line
                type="monotone"
                dataKey="net"
                name="Net"
                stroke="var(--color-net)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-muted-foreground text-sm">
            No daily data available for the selected filters
          </div>
        )}
      </div>

      {/* Category Details Table */}
      <div className="rounded-lg border p-3 sm:p-4">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Category Details</h2>
        {analytics.byCategory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm">Category</th>
                  <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm">Total</th>
                  <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm">Count</th>
                  <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm">%</th>
                </tr>
              </thead>
              <tbody>
                {analytics.byCategory.map((item, index) => (
                  <tr key={item.category} className="border-b">
                    <td className="py-2 px-2 sm:px-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <div
                          className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-xs sm:text-sm truncate">{item.category}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-2 sm:px-4 font-medium text-xs sm:text-sm">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(item.total)}
                    </td>
                    <td className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm">{item.count}</td>
                    <td className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm">{item.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No category data available
          </div>
        )}
      </div>
    </>
  );
}
