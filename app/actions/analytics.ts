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
import { getCurrentManagementId } from "@/lib/management";

export async function fetchAnalyticsFromURL(urlFilter: URLAnalyticsFilter = {}): Promise<AnalyticsData> {
  const managementId = await getCurrentManagementId();
  return getAnalyticsFromURL(urlFilter, managementId);
}

export async function fetchAnalytics(filter: AnalyticsFilter = {}): Promise<AnalyticsData> {
  const managementId = await getCurrentManagementId();
  return getAnalytics(filter, managementId);
}

export async function fetchActivityOverview(daysBack = 182): Promise<ActivityOverview> {
  const managementId = await getCurrentManagementId();
  return getActivityOverview(daysBack, managementId);
}

export async function fetchFilteredSummary(filter: AnalyticsFilter = {}): Promise<{
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  entryCount: number;
}> {
  const managementId = await getCurrentManagementId();
  return getFilteredSummary(filter, managementId);
}

export { fetchCategories };
