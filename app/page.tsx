"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react"
import { AiChat01Icon, Analytics01Icon, BellDotIcon, File01Icon, FlashIcon, Key01Icon, Logout01Icon, Tag01Icon, UserCircleIcon, Wallet01Icon, Alert02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { useSession, signOut } from "@/lib/auth-client";

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
import { QuickFillManager } from "@/components/quick-fill-manager";
import { BudgetManager } from "@/components/budget-manager";
import { RecurringManager } from "@/components/recurring-manager";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useActivityOverview, useSummary } from "@/hooks/use-cashflow-data";
import { useBudgetStatus } from "@/hooks/use-cashflow-data";
import { useRunRecurringGeneration } from "@/hooks/use-cashflow-data";
import type { ActivityOverview } from "@/lib/analytics";
import type { CashflowSummary } from "@/lib/db";
import { getCurrentManagement, createInvite } from "@/app/actions/management";
import { listOAuthConnections, revokeOAuthConnection } from "@/app/actions/oauth";
import type { UserOAuthConnection } from "@/lib/oauth/server";
import { cn } from "@/lib/utils";

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

function BudgetWarningCard() {
  const budgetStatusQuery = useBudgetStatus();
  const allStatuses = budgetStatusQuery.data ?? [];
  const warnings = allStatuses.filter((s) => s.isWarning || s.isOverBudget);

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Budget Warning</span>
      </div>
      {warnings.slice(0, 3).map((s) => (
        <div key={`${s.type}-${s.id}-${s.period}`} className="flex items-center justify-between text-[11px]">
          <span className="text-yellow-700/80 dark:text-yellow-400/80 truncate">
            {s.type === "overall" ? "Total" : s.name} ({s.period})
          </span>
          <span className={cn(
            "font-medium shrink-0 ml-2",
            s.isOverBudget ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
          )}>
            {s.percentage}%
          </span>
        </div>
      ))}
      {warnings.length > 3 && (
        <p className="text-[10px] text-yellow-700/60 dark:text-yellow-400/60">+{warnings.length - 3} lainnya</p>
      )}
    </div>
  );
}

function HomeTab() {
  const summaryQuery = useSummary();
  const activityQuery = useActivityOverview();
  const summary = summaryQuery.data ?? getEmptySummary();
  const activity = activityQuery.data ?? getEmptyActivityOverview();
  const today = formatDateKey(new Date());
  const runGeneration = useRunRecurringGeneration();

  useEffect(() => {
    const key = `recurring-generated-${today}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      runGeneration.mutate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader icon={Wallet01Icon} title="Cashflow Tracker" />

      {summaryQuery.isLoading ? <StatsSkeleton /> : <Stats stats={toStatsData(summary)} />}
      <BudgetWarningCard />
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

function ManagementSettings() {
  const [management, setManagement] = useState<{
    management: {
      id: string;
      name: string;
      members: { id: string; role: string; user: { id: string; name: string | null; email: string; image: string | null } }[];
    };
    role: string;
  } | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    getCurrentManagement().then((m) => {
      if (m) setManagement(m);
    });
  }, []);

  async function handleGenerateInvite() {
    try {
      const code = await createInvite();
      setInviteCode(code);
      setInviteLink(`${window.location.origin}/invite?code=${code}`);
    } catch (err) {
      console.error(err);
    }
  }

  if (!management) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Management</p>
        <p className="text-sm text-muted-foreground">{management.management.name}</p>
        <p className="text-xs text-muted-foreground">Role: {management.role === "owner" ? "Pemilik" : "Anggota"}</p>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Anggota</p>
        <div className="space-y-1.5">
          {management.management.members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 border border-border rounded p-2">
              {member.user.image ? (
                <img src={member.user.image} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                  {member.user.name?.[0]?.toUpperCase() ?? member.user.email[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{member.user.name ?? member.user.email}</p>
                <p className="text-[10px] text-muted-foreground">{member.role === "owner" ? "Pemilik" : "Anggota"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {management.role === "owner" && (
        <div className="space-y-2">
          <Button size="sm" onClick={handleGenerateInvite}>
            Buat Undangan
          </Button>
          {inviteCode && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Bagikan link ini:</p>
              <pre className="bg-muted p-2 rounded text-xs break-all">{inviteLink}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function McpKeySettings() {
  const [connections, setConnections] = useState<UserOAuthConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    listOAuthConnections().then((conns) => {
      setConnections(conns);
      setLoadingConnections(false);
    });
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">OAuth 2.1</p>
        <p className="text-xs text-muted-foreground">
          Gunakan OAuth untuk koneksi yang lebih aman. ChatGPT, Cursor, dan client lainnya
          akan memandu Anda melalui proses login saat menghubungkan.
        </p>
        <CopyField
          label="MCP Server URL"
          value={`${baseUrl}/api/mcp`}
        />
        <p className="text-xs text-muted-foreground">
          Saat menghubungkan dengan AI client (ChatGPT, Cursor, dll), masukkan URL ini
          dan pilih "OAuth" sebagai metode autentikasi.
        </p>

        {loadingConnections ? (
          <p className="text-xs text-muted-foreground">Memuat koneksi...</p>
        ) : connections.length > 0 ? (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium">Koneksi Aktif</p>
            {connections.map((c) => (
              <div key={c.clientId} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.tokenCount} token{c.tokenCount !== 1 ? "s" : ""} aktif
                    {c.scopes.length > 0 && ` · ${c.scopes.join(", ")}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-2 shrink-0 text-red-500 border-red-200 hover:bg-red-50"
                  disabled={revoking === c.clientId}
                  onClick={async () => {
                    setRevoking(c.clientId);
                    try {
                      await revokeOAuthConnection(c.clientId);
                      setConnections((prev) => prev.filter((x) => x.clientId !== c.clientId));
                    } finally {
                      setRevoking(null);
                    }
                  }}
                >
                  {revoking === c.clientId ? "..." : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="relative">
        <pre className="bg-muted p-3 pr-20 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
          {value}
        </pre>
        <Button
          variant="outline"
          size="xs"
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { data: session } = useSession();

  return (
    <>
      <PageHeader icon={UserCircleIcon} title="Setting">
        <ThemeToggle />
      </PageHeader>

      {session?.user && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {session.user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
          </div>
        </div>
      )}

      <Accordion type="single" collapsible className="space-y-2 sm:space-y-3">
        <AccordionItem value="management">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} className="size-4" />
              Management
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ManagementSettings />
          </AccordionContent>
        </AccordionItem>

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

        <AccordionItem value="budget">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4" />
              Budget
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BudgetManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="recurring">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
              Berulang
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <RecurringManager />
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
            <McpKeySettings />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button
        className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white"
        onClick={async () => {
          await signOut();
          window.location.href = "/auth";
        }}
      >
        <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4 mr-2" />
        Keluar
      </Button>
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
