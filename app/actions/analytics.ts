"use server";

import { fetchCategories } from "@/app/actions/categories";
import {
  fetchActivityOverview as getActivityOverview,
  fetchAnalytics as getAnalytics,
  fetchAnalyticsFromURL as getAnalyticsFromURL,
  fetchFilteredSummary as getFilteredSummary,
  type ActivityOverview,
  type AnalyticsData,
  type AnalyticsFilter,
  type URLAnalyticsFilter,
} from "@/lib/analytics";

export type { ActivityOverview, AnalyticsData, AnalyticsFilter, URLAnalyticsFilter };

export async function fetchAnalyticsFromURL(urlFilter: URLAnalyticsFilter = {}): Promise<AnalyticsData> {
  return getAnalyticsFromURL(urlFilter);
}

export async function fetchAnalytics(filter: AnalyticsFilter = {}): Promise<AnalyticsData> {
  return getAnalytics(filter);
}

export async function fetchActivityOverview(daysBack = 182): Promise<ActivityOverview> {
  return getActivityOverview(daysBack);
}

export async function fetchFilteredSummary(filter: AnalyticsFilter = {}): Promise<{
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  entryCount: number;
}> {
  return getFilteredSummary(filter);
}

export { fetchCategories };
