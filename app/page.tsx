"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react"
import { AiChat01Icon, Analytics01Icon, BellDotIcon, File01Icon, FlashIcon, Tag01Icon, UserCircleIcon, Wallet01Icon } from "@hugeicons/core-free-icons";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { CashflowTable } from "@/components/cashflow-table";
import { McpConnectionGuide } from "@/components/mcp-connection-guide";
import { CashflowFormDrawer } from "@/components/cashflow-form-drawer";
import { ActivityHeatmapSkeleton, StatsSkeleton } from "@/components/loading-skeletons";
import { MobileBottomNav, type AppTab } from "@/components/mobile-bottom-nav";
import { PageHeader } from "@/components/page-header";
import { SidebarNav } from "@/components/sidebar-nav";
import { Stats, type StatsData } from "@/components/stats";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryManager } from "@/components/category-manager";
import { QuickFillManager } from "@/components/quick-fill-manager";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useActivityOverview, useSummary } from "@/hooks/use-cashflow-data";
import type { ActivityOverview } from "@/lib/analytics";
import type { CashflowSummary } from "@/lib/db";

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
        setMessage("Notifikasi push tidak didukung di browser ini.");
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
      setMessage("Notifikasi push belum dikonfigurasi.");
      return;
    }

    setIsBusy(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("Izin notifikasi tidak diberikan.");
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
      setMessage("Aktif jam 20:00 WIB");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengaktifkan pengingat.");
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
      setMessage("Pengingat dimatikan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mematikan pengingat.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (message && !isBusy) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message, isBusy])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Pengingat harian</span>
        {message && !isBusy && (
          <span className="text-xs text-muted-foreground">{message}</span>
        )}
      </div>
      <Switch
        checked={isEnabled}
        disabled={!isSupported || isBusy}
        onCheckedChange={(checked) => {
          if (checked) {
            enableReminder()
          } else {
            disableReminder()
          }
        }}
      />
    </div>
  );
}

function HomeTab() {
  const summaryQuery = useSummary();
  const activityQuery = useActivityOverview();
  const summary = summaryQuery.data ?? getEmptySummary();
  const activity = activityQuery.data ?? getEmptyActivityOverview();
  const today = formatDateKey(new Date());

  return (
    <>
      <PageHeader icon={Wallet01Icon} title="Cashflow Tracker" />

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
      <PageHeader icon={UserCircleIcon} title="Setting">
        <ThemeToggle />
      </PageHeader>

      <Accordion type="single" collapsible className="space-y-2 sm:space-y-3">
        <AccordionItem value="quick-fill">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-4" />
              Quick fill
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <QuickFillManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="categories">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} className="size-4" />
              Kategori
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CategoryManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reminder">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={BellDotIcon} strokeWidth={2} className="size-4" />
              Pengingat
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <DailyReminderPreference />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="connect-ai">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={AiChat01Icon} strokeWidth={2} className="size-4" />
              Hubungkan AI
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <McpConnectionGuide />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (typeof window === "undefined") return "home";
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return tab === "summary" || tab === "catatan" || tab === "setting" ? tab : "home";
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

          <TabsContent value="setting" className="mt-0">
            <ProfileTab />
          </TabsContent>
        </main>
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </Tabs>
    </>
  );
}
