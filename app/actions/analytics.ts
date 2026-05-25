"use server";

import { notion, DATA_SOURCE_ID } from "@/lib/notion";
import type { IOType, CategoryType } from "@/lib/notion";
import type { QueryDataSourceParameters } from "@notionhq/client";

// Filter options for analytics
export interface AnalyticsFilter {
  io?: IOType;
  category?: CategoryType;
  startDate?: string;
  endDate?: string;
}

// URL-based filter options (used by server component)
export interface URLAnalyticsFilter {
  from?: string;
  to?: string;
  allTime?: boolean;
  io?: IOType;
  category?: CategoryType;
}

// Analytics data types
export interface CategoryAnalytics {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyAnalytics {
  month: string;
  year: number;
  monthLabel: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DailyAnalytics {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

export interface ActivityDay {
  date: string;
  count: number;
  income: number;
  expenses: number;
}

export interface ActivityOverview {
  days: ActivityDay[];
  totalEntries: number;
  activeDays: number;
  currentStreak: number;
}

export interface AnalyticsData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    entryCount: number;
  };
  byCategory: CategoryAnalytics[];
  byMonth: MonthlyAnalytics[];
  byDay: DailyAnalytics[];
  filteredBy: AnalyticsFilter;
}

// Type for page with properties
interface PageWithProperties {
  id: string;
  properties: Record<string, unknown>;
}

// Helper functions to extract values from Notion properties
function extractNumber(prop: { type: string; number?: number } | undefined): number {
  if (!prop || prop.type !== "number") return 0;
  return prop.number || 0;
}

function extractSelect(prop: { type: string; select?: { name?: string } } | undefined): string | null {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name || null;
}

function extractDate(prop: { type: string; date?: { start?: string } } | undefined): string | null {
  if (!prop || prop.type !== "date") return null;
  return prop.date?.start || null;
}

/**
 * Add one day to a date string (YYYY-MM-DD format)
 * This is needed because Notion's 'before' filter excludes the date,
 * so to include the end date, we need to query 'before (end date + 1)'
 */
function addOneDayToDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function subtractDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() - days);
  return nextDate;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCurrentStreak(activeDateKeys: Set<string>, today: Date): number {
  let streak = 0;
  let cursor = startOfDay(today);

  while (activeDateKeys.has(formatDateKey(cursor))) {
    streak += 1;
    cursor = subtractDays(cursor, 1);
  }

  return streak;
}

/**
 * Convert URL-based filter to AnalyticsFilter
 * URL params use 'from' and 'to' while internal uses 'startDate' and 'endDate'
 * The 'to' date is adjusted by +1 day so that the selected end date is included
 */
function urlFilterToAnalyticsFilter(urlFilter: URLAnalyticsFilter): AnalyticsFilter {
  return {
    io: urlFilter.io,
    category: urlFilter.category,
    startDate: urlFilter.from,
    endDate: urlFilter.to ? addOneDayToDate(urlFilter.to) : undefined,
  };
}

/**
 * Build Notion filter object from analytics filter
 * Uses the same pattern as getEntriesFiltered in lib/notion.ts
 * Uses 'as any' to bypass Notion SDK's complex filter type checking
 */
type QueryDataSourceFilter = NonNullable<QueryDataSourceParameters["filter"]>;
type QueryDataSourcePropertyFilter = Extract<QueryDataSourceFilter, { property: string }>;

function buildNotionFilter(filter: AnalyticsFilter): QueryDataSourceFilter | undefined {
  // Build individual filters
  const ioFilter = filter.io ? {
    property: "I/O",
    select: { equals: filter.io },
  } : null;

  const categoryFilter = filter.category ? {
    property: "Category",
    select: { equals: filter.category },
  } : null;

  const dateFilter = (filter.startDate || filter.endDate) ? {
    property: "Date",
    date: {
      ...(filter.startDate ? { on_or_after: filter.startDate } : {}),
      ...(filter.endDate ? { before: filter.endDate } : {}),
    },
  } : null;

  // Combine filters
  const allFilters = [ioFilter, categoryFilter, dateFilter].filter(Boolean) as QueryDataSourcePropertyFilter[];

  if (allFilters.length === 0) {
    return undefined;
  }
  if (allFilters.length === 1) {
    return allFilters[0];
  }
  // For multiple filters, use AND combination
  return { and: allFilters };
}

/**
 * Fetch analytics data with URL-based filtering - wrapper for server component
 * Converts URL params (from, to, allTime) to internal filter format
 */
export async function fetchAnalyticsFromURL(urlFilter: URLAnalyticsFilter = {}): Promise<AnalyticsData> {
  const filter = urlFilterToAnalyticsFilter(urlFilter);
  return fetchAnalytics(filter);
}

/**
 * Fetch analytics data with optional filtering - uses native Notion filtering
 * This is efficient because it:
 * 1. Uses native Notion data source query with filters
 * 2. Extracts only needed properties directly from response
 * 3. Computes statistics without fetching each page separately
 */
export async function fetchAnalytics(filter: AnalyticsFilter = {}): Promise<AnalyticsData> {
  const notionFilter = buildNotionFilter(filter);

  // Summary statistics
  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    entryCount: 0,
  };

  // Category aggregation
  const categoryMap = new Map<string, { total: number; count: number }>();

  // Monthly aggregation
  const monthMap = new Map<string, { income: number; expenses: number }>();

  // Daily aggregation
  const dayMap = new Map<string, { income: number; expenses: number }>();

  // Paginate through all results with native Notion filter
  let nextCursor: string | null = null;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: notionFilter,
      page_size: 100,
      start_cursor: nextCursor || undefined,
    });

    for (const page of response.results) {
      if ("properties" in page) {
        const props = (page as PageWithProperties).properties as Record<
          string,
          { type: string; [key: string]: unknown }
        >;

        // Extract only what we need for analytics
        const nominalProp = props["Nominal"];
        const ioProp = props["I/O"];
        const categoryProp = props["Category"];
        const dateProp = props["Date"];

        const nominal = extractNumber(nominalProp);
        const io = extractSelect(ioProp);
        const category = extractSelect(categoryProp);
        const date = extractDate(dateProp);

        // Update summary
        summary.entryCount += 1;

        if (io === "Income") {
          summary.totalIncome += nominal;
        } else if (io === "Expenses") {
          summary.totalExpenses += nominal;
        }

        // Update category aggregation
        if (category) {
          const existing = categoryMap.get(category) || { total: 0, count: 0 };
          categoryMap.set(category, {
            total: existing.total + nominal,
            count: existing.count + 1,
          });
        }

        // Update monthly aggregation
        if (date) {
          const dateObj = new Date(date);
          const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;

          const existing = monthMap.get(monthKey) || { income: 0, expenses: 0 };

          if (io === "Income") {
            existing.income += nominal;
          } else if (io === "Expenses") {
            existing.expenses += nominal;
          }

          monthMap.set(monthKey, existing);

          // Update daily aggregation
          const dateKey = date.split("T")[0];
          const dayExisting = dayMap.get(dateKey) || { income: 0, expenses: 0 };

          if (io === "Income") {
            dayExisting.income += nominal;
          } else if (io === "Expenses") {
            dayExisting.expenses += nominal;
          }

          dayMap.set(dateKey, dayExisting);
        }
      }
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  summary.balance = summary.totalIncome - summary.totalExpenses;

  // Calculate category analytics with percentages
  const totalForPercentage = summary.totalIncome + summary.totalExpenses;
  const byCategory: CategoryAnalytics[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      percentage: totalForPercentage > 0 ? (data.total / totalForPercentage) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Calculate monthly analytics
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const byMonth: MonthlyAnalytics[] = Array.from(monthMap.entries())
    .map(([key, data]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        month: key,
        year,
        monthLabel: `${monthNames[month - 1]} ${year}`,
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate daily analytics
  const byDay: DailyAnalytics[] = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    summary,
    byCategory,
    byMonth,
    byDay,
    filteredBy: filter,
  };
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

interface PageWithCreatedTime {
  id: string;
  created_time: string;
  properties: Record<string, unknown>;
}

function extractCreatedTime(page: { created_time?: string }): string | null {
  if (!page.created_time) return null;
  return page.created_time.split("T")[0];
}

export async function fetchActivityOverview(daysBack = 182): Promise<ActivityOverview> {
  const today = startOfDay(new Date());
  const startDate = subtractDays(today, daysBack - 1);
  const alignedStartDate = getMondayOfWeek(startDate);
  const startDateKey = formatDateKey(alignedStartDate);
  const dayMap = new Map<string, ActivityDay>();
  let nextCursor: string | null = null;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: {
        timestamp: "created_time",
        created_time: {
          on_or_after: startDateKey,
        },
      },
      page_size: 100,
      start_cursor: nextCursor || undefined,
    });

    for (const page of response.results) {
      if ("properties" in page && "created_time" in page) {
        const props = (page as PageWithProperties).properties as Record<
          string,
          { type: string; [key: string]: unknown }
        >;

        const createdDate = extractCreatedTime(page as PageWithCreatedTime);
        if (!createdDate) continue;

        const nominal = extractNumber(props["Nominal"]);
        const io = extractSelect(props["I/O"]);
        const existing = dayMap.get(createdDate) || {
          date: createdDate,
          count: 0,
          income: 0,
          expenses: 0,
        };

        existing.count += 1;
        if (io === "Income") {
          existing.income += nominal;
        } else if (io === "Expenses") {
          existing.expenses += nominal;
        }

        dayMap.set(createdDate, existing);
      }
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  const totalDays = daysBack + (alignedStartDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000);
  const days: ActivityDay[] = [];
  for (let i = 0; i < Math.ceil(totalDays); i += 1) {
    const date = subtractDays(alignedStartDate, -i);
    const dateKey = formatDateKey(date);
    days.push(dayMap.get(dateKey) || { date: dateKey, count: 0, income: 0, expenses: 0 });
  }

  const activeDateKeys = new Set(days.filter((day) => day.count > 0).map((day) => day.date));

  return {
    days,
    totalEntries: days.reduce((total, day) => total + day.count, 0),
    activeDays: activeDateKeys.size,
    currentStreak: getCurrentStreak(activeDateKeys, today),
  };
}

/**
 * Fetch summary with optional filtering - efficient native Notion query
 */
export async function fetchFilteredSummary(filter: AnalyticsFilter = {}): Promise<{
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  entryCount: number;
}> {
  const notionFilter = buildNotionFilter(filter);

  let totalIncome = 0;
  let totalExpenses = 0;
  let entryCount = 0;
  let nextCursor: string | null = null;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: notionFilter,
      page_size: 100,
      start_cursor: nextCursor || undefined,
    });

    for (const page of response.results) {
      if ("properties" in page) {
        const props = (page as PageWithProperties).properties as Record<
          string,
          { type: string; [key: string]: unknown }
        >;

        const nominal = extractNumber(props["Nominal"]);
        const io = extractSelect(props["I/O"]);

        entryCount += 1;

        if (io === "Income") {
          totalIncome += nominal;
        } else if (io === "Expenses") {
          totalExpenses += nominal;
        }
      }
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    entryCount,
  };
}

/**
 * Get available categories for filtering
 */
export async function fetchCategories(): Promise<CategoryType[]> {
  return [
    "sosial",
    "keluarga",
    "clothing",
    "skincare",
    "tidak terduga",
    "Jajan",
    "Transportasi",
    "Belanja",
    "Tagihan",
    "Hiburan",
    "Kesehatan",
    "Lainnya",
  ];
}
