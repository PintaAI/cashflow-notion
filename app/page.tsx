"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { AiChat01Icon, Analytics01Icon, ArrowDown01Icon, BellDotIcon, Calendar03Icon, CurrencyIcon, Edit02Icon, File01Icon, FlashIcon, Logout01Icon, PercentIcon, Tag01Icon, UserCircleIcon, Wallet01Icon, Alert02Icon, RefreshIcon, Table01Icon } from "@hugeicons/core-free-icons";
import { getPalette, getSwatches } from "colorthief";
import { useSession, signOut } from "@/lib/auth-client";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AnalyticsCharts } from "@/components/analytics-charts";
import { CashflowTable } from "@/components/cashflow-table";
import { CashflowCalendar } from "@/components/cashflow-calendar";
import { AuditDrawer } from "@/components/audit-drawer";
import { AuditStatusBar } from "@/components/audit-status-bar";

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
import {
  getCurrentManagement,
  createInvite,
  deleteInvite,
  getManagementInvitations,
  getUserManagements,
  removeManagementMember,
  switchManagement,
  renameManagement,
  createManagement,
  type ManagementInvitation,
  type ManagementWithMembers,
} from "@/app/actions/management";
import { listOAuthConnections, revokeOAuthConnection } from "@/app/actions/oauth";
import { fetchProfileTheme, saveProfileTheme, updateProfile, type ProfileActionState } from "@/app/actions/profile";
import type { UserOAuthConnection } from "@/lib/oauth/server";
import { cn } from "@/lib/utils"
import { useCurrency } from "@/components/providers/currency-provider"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { generateThemeFromSwatches, parseThemeColors, type GeneratedThemeColors } from "@/lib/theme-palettes";
import { LOCAL_THEME_CHANGED_EVENT, LOCAL_THEMES_KEY, SELECTED_LOCAL_THEME_KEY, type LocalTheme } from "@/components/local-theme-style";

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
  const [managements, setManagements] = useState<Awaited<ReturnType<typeof getUserManagements>>>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    getUserManagements().then(setManagements);
  }, []);

  useEffect(() => {
    const key = `recurring-generated-${today}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      runGeneration.mutate();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = managements.find((m) => m.isActive);
  const hasMultiple = managements.length > 1;

  async function handleSwitch(id: string) {
    setSwitcherOpen(false);
    try {
      await switchManagement(id);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 relative">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-9">
            <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.2} className="size-4.5 sm:size-5" />
          </span>
          {hasMultiple ? (
            <button
              type="button"
              onClick={() => setSwitcherOpen(!switcherOpen)}
              className="flex items-center gap-1 text-xl font-bold tracking-tight sm:text-2xl hover:text-primary transition-colors"
            >
              <span className="truncate max-w-[200px] sm:max-w-[300px]">{active?.name ?? "Cashflow"}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className={cn("size-4 shrink-0 text-muted-foreground transition-transform", switcherOpen && "rotate-180")} />
            </button>
          ) : (
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{active?.name ?? "Cashflow"}</h1>
          )}
          {switcherOpen && hasMultiple && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border bg-popover p-1 shadow-md">
                {managements.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSwitch(m.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors",
                      m.isActive && "bg-accent"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.memberCount} anggota · {m.role === "owner" ? "Pemilik" : "Anggota"}
                      </p>
                    </div>
                    {m.isActive && (
                      <span className="size-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {summaryQuery.isLoading ? <StatsSkeleton /> : <Stats stats={toStatsData(summary)} />}
      <BudgetWarningCard />
      {activityQuery.isLoading ? <ActivityHeatmapSkeleton /> : <ActivityHeatmap activity={activity} />}
      <CashflowTable dateFilter={today} />
    </>
  );
}

function CatatanTab() {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader icon={File01Icon} title="Catatan" />
        <div className="flex items-center rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={Table01Icon} strokeWidth={2} className="size-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "calendar"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-3.5" />
            Kalender
          </button>
        </div>
      </div>

      {view === "list" ? <CashflowTable /> : <CashflowCalendar />}
    </>
  );
}

function ManagementSettings() {
  const { data: session } = useSession();
  const [management, setManagement] = useState<ManagementWithMembers | null>(null);
  const [managements, setManagements] = useState<Awaited<ReturnType<typeof getUserManagements>>>([]);
  const [invitations, setInvitations] = useState<ManagementInvitation[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    getCurrentManagement().then((m) => {
      if (m) {
        setManagement(m);
        setNameValue(m.management.name);
      }
    });
    getUserManagements().then(setManagements);
    getManagementInvitations()
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }

  useEffect(() => { load(); }, []);

  async function handleSwitch(id: string) {
    try {
      await switchManagement(id);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerateInvite() {
    setCreatingInvite(true);
    try {
      await createInvite();
      setInvitations(await getManagementInvitations());
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleDeleteInvite(invitationId: string) {
    setDeletingInviteId(invitationId);
    try {
      await deleteInvite(invitationId);
      setInvitations((prev) => prev.filter((invitation) => invitation.id !== invitationId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingInviteId(null);
    }
  }

  async function handleCopyInvite(invitationId: string, inviteLink: string) {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteId(invitationId);
      window.setTimeout(() => setCopiedInviteId(null), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingMemberId(memberId);
    try {
      await removeManagementMember(memberId);
      setManagement((prev) => prev
        ? {
            ...prev,
            management: {
              ...prev.management,
              members: prev.management.members.filter((member) => member.id !== memberId),
            },
          }
        : prev
      );
      setManagements(await getUserManagements());
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === management?.management.name) {
      setEditingName(false);
      setNameValue(management?.management.name ?? "");
      return;
    }
    setNameSaving(true);
    try {
      await renameManagement(trimmed);
      setManagement((prev) =>
        prev ? { ...prev, management: { ...prev.management, name: trimmed } } : prev
      );
    } catch (err) {
      setNameValue(management?.management.name ?? "");
      console.error(err);
    } finally {
      setNameSaving(false);
      setEditingName(false);
    }
  }

  async function handleCreate() {
    const trimmed = createName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createManagement(trimmed);
      setCreateOpen(false);
      setCreateName("");
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  if (!management) return null;

  const isOwner = management.role === "owner";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCreateOpen(!createOpen)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-solid transition-colors"
        >
          + Buat Dompet Baru
        </button>
        {createOpen && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nama dompet"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              disabled={creating}
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? "..." : "Buat"}
            </Button>
          </div>
        )}
      </div>

      {managements.length > 0 && (
        <div className="space-y-1.5">
          {managements.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 transition-colors",
                m.isActive
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50 cursor-pointer"
              )}
              onClick={() => {
                if (!m.isActive) handleSwitch(m.id);
              }}
            >
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className={cn("size-4 shrink-0", m.isActive ? "text-primary" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                {editingName && m.isActive && isOwner ? (
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setEditingName(false);
                        setNameValue(management.management.name);
                      }
                    }}
                    onBlur={handleSaveName}
                    disabled={nameSaving}
                    className="w-full bg-transparent text-sm font-medium outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className={cn("text-sm font-medium truncate", m.isActive && "text-primary")}>{m.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {m.memberCount} anggota · {m.role === "owner" ? "Pemilik" : "Anggota"}
                </p>
              </div>
              {m.isActive && isOwner && !editingName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNameValue(management.management.name);
                    setEditingName(true);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3" />
                </button>
              )}
              {m.isActive && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Aktif</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">Anggota</p>
        <div className="space-y-1.5">
          {management.management.members.map((member) => {
            const memberImageSrc = getProfileImageSrc(member.user.image);

            return (
            <div key={member.id} className="flex items-center gap-2 border border-border rounded p-2">
              {memberImageSrc ? (
                <Image src={memberImageSrc} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" unoptimized />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                  {member.user.name?.[0]?.toUpperCase() ?? member.user.email[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{member.user.name ?? member.user.email}</p>
                <p className="text-[10px] text-muted-foreground">{member.role === "owner" ? "Pemilik" : "Anggota"}</p>
              </div>
              {isOwner && member.role !== "owner" && member.user.id !== session?.user.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={removingMemberId === member.id}
                >
                  {removingMemberId === member.id ? "Menghapus..." : "Hapus"}
                </Button>
              )}
            </div>
          );
          })}
        </div>
      </div>

      {isOwner && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Undangan</p>
            <Button size="sm" onClick={handleGenerateInvite} disabled={creatingInvite}>
              {creatingInvite ? "Membuat..." : "Buat Undangan"}
            </Button>
          </div>
          {invitations.length > 0 ? (
            <div className="space-y-1.5">
              {invitations.map((invitation) => {
                const isExpired = new Date(invitation.expiresAt) < new Date();
                const inviteLink = `${origin}/invite?code=${invitation.code}`;

                return (
                  <div key={invitation.id} className="space-y-2 rounded-md border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        invitation.status === "pending" && !isExpired
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isExpired ? "Kadaluarsa" : invitation.status === "pending" ? "Aktif" : "Digunakan"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteInvite(invitation.id)}
                        disabled={deletingInviteId === invitation.id}
                      >
                        {deletingInviteId === invitation.id ? "Menghapus..." : "Hapus"}
                      </Button>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 rounded bg-muted p-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {inviteLink}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyInvite(invitation.id, inviteLink)}
                      >
                        {copiedInviteId === invitation.id ? "Tersalin" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Dibuat {new Date(invitation.createdAt).toLocaleDateString("id-ID")} · Berlaku sampai {new Date(invitation.expiresAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada undangan.</p>
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
          dan pilih &quot;OAuth&quot; sebagai metode autentikasi.
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

function getProfileImageSrc(image: string | null | undefined) {
  if (!image) return null;
  if (image.startsWith("profiles/")) {
    return `/api/profile-photo?pathname=${encodeURIComponent(image)}`;
  }

  return image;
}

type EditableProfileUser = {
  name: string;
  email: string;
  image: string | null;
};

const initialProfileState: ProfileActionState = {
  status: "idle",
  message: "",
};

function getLocalThemes(): LocalTheme[] {
  try {
    const rawThemes = window.localStorage.getItem(LOCAL_THEMES_KEY);
    if (!rawThemes) return [];
    const parsed = JSON.parse(rawThemes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalTheme(theme: LocalTheme) {
  const nextThemes = [theme, ...getLocalThemes().filter((item) => item.id !== theme.id)].slice(0, 5);
  window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
  window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, theme.id);
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
}

function subscribeLocalThemes(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange);
  };
}

function getLocalThemesSnapshot() {
  return window.localStorage.getItem(LOCAL_THEMES_KEY) ?? "[]";
}

function getSelectedLocalThemeSnapshot() {
  return window.localStorage.getItem(SELECTED_LOCAL_THEME_KEY) ?? "";
}

function getEmptyLocalThemesSnapshot() {
  return "[]";
}

function getEmptySelectedLocalThemeSnapshot() {
  return "";
}

function parseLocalThemesSnapshot(snapshot: string): LocalTheme[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ProfileEditor({ user, onUpdated }: { user: EditableProfileUser; onUpdated: (user: EditableProfileUser, generatedTheme: GeneratedThemeColors | null) => void }) {
  const [state, setState] = useState<ProfileActionState>(initialProfileState);
  const [pending, setPending] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const [generatedTheme, setGeneratedTheme] = useState<GeneratedThemeColors | null>(null);
  const [themeMessage, setThemeMessage] = useState("");
  const [themeLoading, setThemeLoading] = useState(false);
  const themeExtractionRef = useRef<Promise<GeneratedThemeColors | null> | null>(null);

  async function extractThemeFromImageUrl(url: string) {
    const image = new window.Image();
    image.decoding = "async";
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load profile image preview"));
    });

    const swatches = await getSwatches(image, {
      colorCount: 12,
      quality: 5,
      colorSpace: "oklch",
      minSaturation: 0.08,
    });
    const palette = await getPalette(image, {
      colorCount: 8,
      quality: 5,
      colorSpace: "oklch",
      minSaturation: 0.08,
    });
    const semanticSwatches = [
      swatches.Vibrant,
      swatches.Muted,
      swatches.LightVibrant,
      swatches.DarkVibrant,
      swatches.LightMuted,
      swatches.DarkMuted,
    ].flatMap((swatch) => swatch?.color.hex() ?? []);
    const paletteSwatches = palette?.map((color) => color.hex()) ?? [];

    return generateThemeFromSwatches([...semanticSwatches, ...paletteSwatches]);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      themeExtractionRef.current = null;
      setThemeLoading(false);
      setGeneratedTheme(null);
      setThemeMessage("");
      setObjectPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setGeneratedTheme(null);
    setThemeMessage("Membuat tema dari foto...");
    setThemeLoading(true);
    setObjectPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextPreviewUrl;
    });

    const extraction = extractThemeFromImageUrl(nextPreviewUrl)
      .then((theme) => {
        setGeneratedTheme(theme);
        setThemeMessage(theme ? "Tema dari foto siap disimpan." : "Palet warna foto tidak cukup kuat untuk membuat tema.");
        return theme;
      })
      .catch(() => {
        setGeneratedTheme(null);
        setThemeMessage("Gagal membuat tema dari foto.");
        return null;
      })
      .finally(() => {
        if (themeExtractionRef.current === extraction) {
          setThemeLoading(false);
          themeExtractionRef.current = null;
        }
      });

    themeExtractionRef.current = extraction;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      let readyTheme = generatedTheme;
      const extraction = themeExtractionRef.current;
      if (extraction) {
        setThemeLoading(true);
        readyTheme = await extraction;
        setThemeLoading(false);
      }

      const result = await updateProfile(state, new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success" && result.user) {
        onUpdated(result.user, readyTheme);
        setObjectPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        setGeneratedTheme(null);
        setThemeMessage("");
      }
    } finally {
      setPending(false);
    }
  }

  const previewUrl = objectPreviewUrl ?? getProfileImageSrc(user.image);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        {previewUrl ? (
          <Image src={previewUrl} alt="Foto profil" width={64} height={64} className="size-16 rounded-full object-cover" unoptimized />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium">Foto profil</p>
          <Input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} />
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP, atau GIF. Maksimal 5 MB.</p>
          {themeMessage && <p className="text-xs text-muted-foreground" aria-live="polite">{themeMessage}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="profile-name" className="text-sm font-medium">Nama</label>
        <Input id="profile-name" name="name" defaultValue={user.name} minLength={2} maxLength={80} required />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="profile-email" className="text-sm font-medium">Email</label>
        <Input id="profile-email" value={user.email} disabled />
      </div>

      {state.message && (
        <p className={cn("text-xs", state.status === "error" ? "text-red-500" : "text-emerald-600")} aria-live="polite">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending || themeLoading}>
        {pending ? "Menyimpan..." : themeLoading ? "Menganalisis foto..." : "Simpan Profil"}
      </Button>
    </form>
  );
}

function ThemeSettings() {
  const themesSnapshot = useSyncExternalStore(subscribeLocalThemes, getLocalThemesSnapshot, getEmptyLocalThemesSnapshot);
  const selectedThemeSnapshot = useSyncExternalStore(subscribeLocalThemes, getSelectedLocalThemeSnapshot, getEmptySelectedLocalThemeSnapshot);
  const themes = parseLocalThemesSnapshot(themesSnapshot);
  const selectedThemeId = selectedThemeSnapshot || null;
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleThemeChange(value: string) {
    const nextThemeId = value === "default" ? null : value;
    setMessage("");

    startTransition(() => {
      if (nextThemeId) {
        window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, nextThemeId);
      } else {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
      setMessage("Tema berhasil diterapkan di perangkat ini.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Tema baru dibuat otomatis dari warna foto profil saat Anda mengunggah foto baru. Maksimal 5 tema disimpan di perangkat ini; tema tertua akan dihapus saat melewati batas.
        </p>
      </div>

      <Select value={selectedThemeId ?? "default"} onValueChange={handleThemeChange} disabled={isPending}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih tema" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Tema bawaan</SelectItem>
          {themes.map((theme) => (
            <SelectItem key={theme.id} value={theme.id}>{theme.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {themes.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors hover:bg-accent/60",
                selectedThemeId === theme.id && "border-primary bg-primary/5"
              )}
              disabled={isPending}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{theme.name}</p>
                {selectedThemeId === theme.id && <span className="text-xs text-primary">Aktif</span>}
              </div>
              <div className="flex overflow-hidden rounded-md border">
                {(parseThemeColors(theme.colors)?.swatches ?? []).map((swatch) => (
                  <span key={swatch} className="h-8 flex-1" style={{ backgroundColor: swatch }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada tema tersimpan. Unggah foto profil untuk membuat tema dari palet warna foto.
        </p>
      )}

      {message && <p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>}
    </div>
  );
}

function ProfileTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const { currency, setCurrency, loading } = useCurrency();
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<EditableProfileUser | null>(null);
  const sessionUser = session?.user ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  } : null;
  const visibleProfileUser = profileUser ?? sessionUser;

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;
    fetchProfileTheme()
      .then((theme) => {
        if (cancelled || !theme || getLocalThemes().length > 0) return;

        saveLocalTheme({
          id: crypto.randomUUID(),
          name: "Profile theme",
          colors: theme,
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Local themes remain the source of truth when remote sync is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return (
    <>
      <PageHeader icon={UserCircleIcon} title="Setting">
        <ThemeToggle />
      </PageHeader>

      {visibleProfileUser && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border p-3">
          {getProfileImageSrc(visibleProfileUser.image) ? (
            <Image src={getProfileImageSrc(visibleProfileUser.image)!} alt="Foto profil" width={36} height={36} className="size-9 rounded-full object-cover" unoptimized />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {visibleProfileUser.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{visibleProfileUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{visibleProfileUser.email}</p>
          </div>
        </div>
      )}

      <Accordion type="single" collapsible className="space-y-2 sm:space-y-3">
        {visibleProfileUser && (
          <AccordionItem value="profile">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} className="size-4" />
                Profil
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ProfileEditor
                user={visibleProfileUser}
                onUpdated={(user, generatedTheme) => {
                  setProfileUser(user);
                  if (generatedTheme) {
                    saveLocalTheme({
                      id: crypto.randomUUID(),
                      name: `Profile theme ${new Date().toLocaleDateString("id-ID")}`,
                      colors: generatedTheme,
                      createdAt: new Date().toISOString(),
                    });
                    void saveProfileTheme(generatedTheme).catch(() => {});
                  }
                  router.refresh();
                }}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="theme">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
              Tema
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ThemeSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="currency">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={CurrencyIcon} strokeWidth={2} className="size-4" />
              Mata Uang
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Pilih mata uang untuk tampilan. Semua data tetap disimpan dalam IDR.
              </p>
              <Select value={currency} onValueChange={setCurrency} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="management">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4" />
              Dompet
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
              <HugeiconsIcon icon={PercentIcon} strokeWidth={2} className="size-4" />
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

      <div className="mt-4 mb-4">
        <AuditStatusBar onAuditClick={() => setAuditDrawerOpen(true)} />
      </div>

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
      <AuditDrawer open={auditDrawerOpen} onOpenChange={setAuditDrawerOpen} />
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
