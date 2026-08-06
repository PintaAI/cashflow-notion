"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { ActivityHeatmap } from "@/components/dashboard";
import { CashflowTable } from "@/components/entries";
import { ActivityHeatmapSkeleton, StatsSkeleton } from "@/components/utils";
import { Stats, type StatsData } from "@/components/dashboard";
import { useActivityOverview, useSummary, useBudgetStatus, useRunRecurringGeneration } from "@/hooks/use-cashflow-data";
import { getUserManagements, switchManagement } from "@/app/actions/management";
import { useManagement } from "@/components/providers/management-provider";
import type { ActivityOverview } from "@/lib/analytics";
import type { CashflowSummary } from "@/lib/db";
import { SidebarTrigger } from "@/components/layout";
import { getWeekNumber, getWeekStartEnd, toDateKey } from "@/lib/date";
import { cn } from "@/lib/utils"

const WALLET_CACHE_KEY = "cashflow_wallets";

type WalletMeta = { id: string; name: string; isActive: boolean };
type UserManagements = Awaited<ReturnType<typeof getUserManagements>>;

function readWalletCache(): WalletMeta[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WALLET_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeWalletCache(data: WalletMeta[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function getCachedManagements(managementId: string): UserManagements {
  const cached = readWalletCache();
  if (!cached || cached.length === 0) return [];
  const now = new Date().toISOString();

  return cached.map((m) => ({
    id: m.id,
    name: m.name,
    category: null,
    image: null,
    imageTheme: null,
    role: "" as never,
    memberCount: 0,
    createdAt: now,
    updatedAt: now,
    isActive: m.id === managementId,
  })) as UserManagements;
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
      weekStart: toDateKey(weekStart),
      weekEnd: toDateKey(weekEnd),
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
      date: toDateKey(date),
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
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    balance: summary.balance,
    currentWeek: summary.currentWeek,
    currentMonth: summary.currentMonth,
    topExpenseCategories: summary.topExpenseCategories,
    weeklyBreakdown: summary.weeklyBreakdown,
  };
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

export function HomeTab() {
  const router = useRouter();
  const { managementId } = useManagement();
  const summaryQuery = useSummary();
  const activityQuery = useActivityOverview();
  const summary = summaryQuery.data ?? getEmptySummary();
  const activity = activityQuery.data ?? getEmptyActivityOverview();
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const runGeneration = useRunRecurringGeneration();
  const [managements, setManagements] = useState<UserManagements>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const cached = getCachedManagements(managementId);
      if (cached.length > 0) setManagements(cached);
    });

    getUserManagements(managementId).then((data) => {
      if (cancelled) return;
      setManagements(data);
      writeWalletCache(data.map((m) => ({ id: m.id, name: m.name, isActive: m.isActive })));
    });

    return () => {
      cancelled = true;
    };
  }, [managementId]);

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
      setManagements((prev) => {
        const next = prev.map((m) => ({ ...m, isActive: m.id === id }));
        writeWalletCache(next.map((m) => ({ id: m.id, name: m.name, isActive: m.isActive })));
        return next;
      });
      router.push(`/dompet/${id}`);
      router.refresh();
      void switchManagement(id).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 relative">
          <SidebarTrigger />
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
      {activityQuery.isLoading ? <ActivityHeatmapSkeleton /> : <ActivityHeatmap activity={activity} selectedDate={selectedDate} onDateSelect={setSelectedDate} />}
      <CashflowTable dateFilter={selectedDate} onDateFilterChange={setSelectedDate} />
    </>
  );
}
