"use client";

import { useState } from "react";
import { Analytics01Icon, UserCircleIcon, Wallet01Icon } from "@hugeicons/core-free-icons";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { CashflowTable } from "@/components/cashflow-table";
import { ActivityHeatmapSkeleton, StatsSkeleton } from "@/components/loading-skeletons";
import { MobileBottomNav, type AppTab } from "@/components/mobile-bottom-nav";
import { PageHeader } from "@/components/page-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Stats, type StatsData } from "@/components/stats";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryManager } from "@/components/category-manager";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useActivityOverview, useSummary } from "@/hooks/use-cashflow-data";
import type { ActivityOverview } from "@/app/actions/analytics";
import type { CashflowSummary } from "@/lib/notion";

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekStartEnd(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const start = new Date(date.getFullYear(), date.getMonth(), diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getWeekNumber(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const pastDaysOfMonth = date.getDate() + firstDayOfMonth.getDay() - 1;
  return Math.ceil(pastDaysOfMonth / 7);
}

function getEmptySummary(): CashflowSummary {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekStartEnd(now);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return {
    totalEntries: 0,
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    byCategory: {},
    byIO: { Income: 0, Expenses: 0 },
    currentWeek: {
      weekNumber: getWeekNumber(now),
      weekStart: formatDateKey(weekStart),
      weekEnd: formatDateKey(weekEnd),
      income: 0,
      expenses: 0,
    },
    currentMonth: {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      monthName: monthNames[now.getMonth()],
      year: now.getFullYear(),
      income: 0,
      expenses: 0,
    },
    topExpenseCategories: [],
    weeklyBreakdown: [],
  };
}

function getEmptyActivityOverview(daysBack = 182): ActivityOverview {
  const today = new Date();
  const days = Array.from({ length: daysBack }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (daysBack - index - 1));

    return {
      date: formatDateKey(date),
      count: 0,
    };
  });

  return {
    days,
    totalEntries: 0,
    activeDays: 0,
    currentStreak: 0,
  };
}

function toStatsData(summary: CashflowSummary): StatsData {
  return {
    totalEntries: summary.totalEntries,
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    balance: summary.balance,
    currentWeek: summary.currentWeek,
    currentMonth: summary.currentMonth,
    topExpenseCategories: summary.topExpenseCategories,
    weeklyBreakdown: summary.weeklyBreakdown,
  };
}

function HomeTab() {
  const summaryQuery = useSummary();
  const activityQuery = useActivityOverview();
  const isDataUnavailable = summaryQuery.isError || activityQuery.isError;
  const summary = summaryQuery.data ?? getEmptySummary();
  const activity = activityQuery.data ?? getEmptyActivityOverview();

  return (
    <>
      <PageHeader icon={Wallet01Icon} title="Cashflow Tracker">
        <ThemeToggle />
      </PageHeader>

      {isDataUnavailable && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Notion is temporarily unavailable. Showing an empty overview while live data reconnects.
        </div>
      )}

      {summaryQuery.isLoading ? <StatsSkeleton /> : <Stats stats={toStatsData(summary)} />}
      {activityQuery.isLoading ? <ActivityHeatmapSkeleton /> : <ActivityHeatmap activity={activity} />}
      <CashflowTable />
    </>
  );
}

function ProfileTab() {
  return (
    <>
      <PageHeader icon={UserCircleIcon} title="Profile">
        <ThemeToggle />
      </PageHeader>

      <section className="rounded-3xl border bg-card p-5 text-card-foreground shadow-sm space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Categories</h3>
          <CategoryManager />
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Profile settings and preferences can live here.
          </p>
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");

  return (
    <Tabs orientation="vertical" value={activeTab} onValueChange={(value) => setActiveTab(value as AppTab)}>
      <div className="flex min-h-dvh w-full">
        <SidebarNav />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-24 sm:py-8 md:pb-8">
          <TabsContent value="home" className="mt-0">
            <HomeTab />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <PageHeader icon={Analytics01Icon} title="Analytics" />
            <AnalyticsCharts />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <ProfileTab />
          </TabsContent>
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </Tabs>
  );
}
