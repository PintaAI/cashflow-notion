"use client";

import { useEffect, useState } from "react";
import { Analytics01Icon, File01Icon, UserCircleIcon, Wallet01Icon } from "@hugeicons/core-free-icons";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { CashflowTable } from "@/components/cashflow-table";
import { CashflowFormDrawer } from "@/components/cashflow-form-drawer";
import { ActivityHeatmapSkeleton, StatsSkeleton } from "@/components/loading-skeletons";
import { MobileBottomNav, type AppTab } from "@/components/mobile-bottom-nav";
import { PageHeader } from "@/components/page-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Stats, type StatsData } from "@/components/stats";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryManager } from "@/components/category-manager";
import { Button } from "@/components/ui/button";
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function DailyReminderPreference() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (!supported) {
      Promise.resolve().then(() => {
        setIsSupported(false);
        setMessage("Push notifications are not supported in this browser.");
      });
      return;
    }

    Promise.resolve().then(() => setIsSupported(true));

    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.pushManager.getSubscription().then((subscription) => {
        setIsEnabled(Boolean(subscription));
      });
    });
  }, []);

  async function enableReminder() {
    if (!vapidPublicKey) {
      setMessage("Push notifications are not configured yet.");
      return;
    }

    setIsBusy(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("Notification permission was not granted.");
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }

      await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        throw new Error("Failed to save notification subscription");
      }

      setIsEnabled(true);
      setMessage("Daily reminder enabled for 8 PM Jakarta time.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to enable daily reminder.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disableReminder() {
    setIsBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }

      setIsEnabled(false);
      setMessage("Daily reminder disabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to disable daily reminder.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-background p-4 space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Daily reminder</h4>
        <p className="text-xs text-muted-foreground">
          Send a push notification at 8 PM Jakarta time only if today has no cashflow entries.
        </p>
      </div>

      <Button
        type="button"
        variant={isEnabled ? "outline" : "default"}
        disabled={!isSupported || isBusy}
        onClick={isEnabled ? disableReminder : enableReminder}
      >
        {isBusy ? "Saving..." : isEnabled ? "Disable reminder" : "Enable reminder"}
      </Button>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

function HomeTab() {
  const summaryQuery = useSummary();
  const activityQuery = useActivityOverview();
  const isDataUnavailable = summaryQuery.isError || activityQuery.isError;
  const summary = summaryQuery.data ?? getEmptySummary();
  const activity = activityQuery.data ?? getEmptyActivityOverview();
  const today = formatDateKey(new Date());

  return (
    <>
      <PageHeader icon={Wallet01Icon} title="Cashflow Tracker" />

      {isDataUnavailable && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Notion is temporarily unavailable. Showing an empty overview while live data reconnects.
        </div>
      )}

      {summaryQuery.isLoading ? <StatsSkeleton /> : <Stats stats={toStatsData(summary)} />}
      {activityQuery.isLoading ? <ActivityHeatmapSkeleton /> : <ActivityHeatmap activity={activity} />}
      <CashflowTable dateFilter={today} />
    </>
  );
}

function CatatanTab() {
  return (
    <>
      <PageHeader icon={File01Icon} title="Catatan" />
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
          <DailyReminderPreference />
        </div>
      </section>
    </>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (typeof window === "undefined") return "home";
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return tab === "summary" || tab === "catatan" || tab === "profile" ? tab : "home";
  });
  const [addDrawerOpen, setAddDrawerOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("action") === "add";
  });

  return (
    <>
      <CashflowFormDrawer mode="create" open={addDrawerOpen} onOpenChange={setAddDrawerOpen} />
      <Tabs orientation="vertical" value={activeTab} onValueChange={(value) => setActiveTab(value as AppTab)}>
      <div className="flex min-h-dvh w-full">
        <SidebarNav />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-24 sm:py-8 md:pb-8">
          <TabsContent value="home" className="mt-0">
            <HomeTab />
          </TabsContent>

          <TabsContent value="catatan" className="mt-0">
            <CatatanTab />
          </TabsContent>

          <TabsContent value="summary" className="mt-0">
            <PageHeader icon={Analytics01Icon} title="Summary" />
            <AnalyticsCharts />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <ProfileTab />
          </TabsContent>
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </Tabs>
    </>
  );
}
