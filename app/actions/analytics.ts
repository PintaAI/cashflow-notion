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
import { resolveManagementId } from "@/lib/management";

export async function fetchAnalyticsFromURL(urlFilter: URLAnalyticsFilter = {}, managementId?: string): Promise<AnalyticsData> {
  managementId = await resolveManagementId(managementId);
  return getAnalyticsFromURL(urlFilter, managementId);
}

export async function fetchAnalytics(filter: AnalyticsFilter = {}, managementId?: string): Promise<AnalyticsData> {
  managementId = await resolveManagementId(managementId);
  return getAnalytics(filter, managementId);
}

export async function fetchActivityOverview(daysBack = 182, managementId?: string): Promise<ActivityOverview> {
  managementId = await resolveManagementId(managementId);
  return getActivityOverview(daysBack, managementId);
}

export async function fetchFilteredSummary(filter: AnalyticsFilter = {}, managementId?: string): Promise<{
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  entryCount: number;
}> {
  managementId = await resolveManagementId(managementId);
  return getFilteredSummary(filter, managementId);
}

export { fetchCategories };
