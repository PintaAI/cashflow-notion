"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  AlertCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import type { DayButton } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CashflowEntry, IOType } from "@/lib/db";
import { getCategoryConfig } from "@/lib/categories";
import { CashflowFormDrawer } from "@/components/cashflow-form-drawer";
import { useCalendarEntries, useCategories } from "@/hooks/use-cashflow-data";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/providers/currency-provider";

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCompactAmount(amount: number, format: (amountIdr: number, opts?: { compact?: boolean }) => string): string {
  return format(amount, { compact: true });
}

function CalendarDayContent({
  day,
  modifiers,
  calendarData,
  locale,
  className,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  calendarData: Record<string, { entries: CashflowEntry[]; income: number; expenses: number }>;
  locale?: Intl.LocalesArgument;
}) {
  const { format } = useCurrency();
  const dateKey = formatDateKey(day.date);
  const dayData = calendarData[dateKey];
  const hasEntries = Boolean(dayData && dayData.entries.length > 0);
  const isToday = modifiers.today;
  const isSelected = modifiers.selected;
  const isOutside = modifiers.outside;
  const net = dayData ? dayData.income - dayData.expenses : 0;

  return (
    <button
      type="button"
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-md p-1 text-center transition-colors md:gap-1 md:p-1.5",
        "hover:bg-muted/70",
        isToday && "border border-primary/50",
        isSelected && "bg-primary/15 ring-1 ring-primary",
        hasEntries && !isSelected && "bg-muted/40",
        isOutside && "opacity-40",
        className,
      )}
      data-has-entries={hasEntries ? "true" : undefined}
      {...props}
    >
      <span className={cn("text-xs md:text-sm leading-none", isToday || isSelected ? "font-bold text-primary" : "text-muted-foreground")}>
        {day.date.toLocaleDateString(locale, { day: "numeric" })}
      </span>
      {hasEntries && (
        <span className={cn("text-[10px] md:text-xs font-medium leading-none truncate", net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-900 dark:text-red-500")}>
          {net >= 0 ? "+" : "-"}{formatCompactAmount(net, format)}
        </span>
      )}
    </button>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="h-7 w-7 rounded bg-muted animate-pulse" />
        <div className="h-5 w-36 rounded bg-muted animate-pulse" />
        <div className="h-7 w-7 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`wh-${i}`} className="h-4 rounded bg-muted animate-pulse" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`dc-${i}`} className="h-14 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

const ioOptions: IOType[] = ["Income", "Expenses"];

export function CashflowCalendar() {
  const [selectedDay, setSelectedDay] = React.useState<Date | undefined>(() => new Date());
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [ioFilter, setIoFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [editingEntry, setEditingEntry] = React.useState<CashflowEntry | null>(null);
  const { format } = useCurrency();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarQuery = useCalendarEntries(year, month);
  const calendarData = React.useMemo(() => calendarQuery.data ?? {}, [calendarQuery.data]);
  const categoriesQuery = useCategories();
  const categoryOptions = categoriesQuery.data ?? [];

  const monthlyTotals = React.useMemo(() => {
    let income = 0;
    let expenses = 0;
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    for (const [dateKey, data] of Object.entries(calendarData)) {
      if (!dateKey.startsWith(monthStr)) continue;
      income += data.income;
      expenses += data.expenses;
    }
    return { income, expenses, net: income - expenses };
  }, [calendarData, year, month]);

  const handleDayClick = React.useCallback((date: Date) => {
    setSelectedDay(date);
  }, []);

  const selectedDayKey = selectedDay ? formatDateKey(selectedDay) : null;
  const selectedDayData = selectedDayKey ? calendarData[selectedDayKey] : null;
  const selectedEntries = React.useMemo(() => {
    if (!selectedDayData) return [];
    let entries = selectedDayData.entries;
    if (ioFilter !== "all") entries = entries.filter((e) => e.io === ioFilter);
    if (categoryFilter !== "all") entries = entries.filter((e) => e.category === categoryFilter);
    return entries;
  }, [selectedDayData, ioFilter, categoryFilter]);

  const hasFilteredEntries = selectedEntries.length > 0;

  if (calendarQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Catatan</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3.5 animate-spin text-primary" />
            <span>Memuat...</span>
          </div>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <CalendarSkeleton />
        </div>
      </div>
    );
  }

  if (calendarQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={1.5} className="size-10 text-red-500" />
        <p className="text-sm font-medium">Gagal memuat data kalender</p>
        <p className="text-xs">{calendarQuery.error?.message ?? "Terjadi kesalahan"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Catatan</h2>
        {calendarQuery.isFetching && !calendarQuery.isLoading && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3.5 animate-spin text-primary" />
            <span>Memuat...</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span>
          <span className="text-muted-foreground">Net: </span>
          <span className="font-medium">
            {formatCompactAmount(monthlyTotals.net, format)}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Income: </span>
          <span className="font-medium text-green-600 dark:text-green-400">
            +{formatCompactAmount(monthlyTotals.income, format)}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Expenses: </span>
          <span className="font-medium text-red-600 dark:text-red-400">
            -{formatCompactAmount(monthlyTotals.expenses, format)}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full pl-9">
              <SelectValue placeholder="Semua kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {categoryOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M7 12h10" /><path d="M11 18h2" />
              </svg>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={ioFilter} onValueChange={setIoFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="I/O" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ioOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Calendar
          mode="single"
          selected={selectedDay}
          onSelect={(day) => { if (day) handleDayClick(day); }}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          captionLayout="label"
          showOutsideDays
          buttonVariant="ghost"
          className="w-full [--cell-size:--spacing(16)]"
          components={{
            DayButton: (props) => (
              <CalendarDayContent {...props} calendarData={calendarData} />
            ),
          }}
        />
      </div>

      {selectedDay && selectedDayData && hasFilteredEntries && (
        <div className="rounded-lg border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-medium">
              {selectedDay.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <span className="text-xs text-muted-foreground">
              {selectedEntries.length} catatan
            </span>
          </div>
          <div className="divide-y">
            {selectedEntries.map((entry) => {
              const isIncome = entry.io === "Income";
              const categoryConfig = entry.category ? getCategoryConfig(entry.category) : null;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setEditingEntry(entry)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium leading-tight truncate">{entry.name}</p>
                    {entry.category && categoryConfig && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        categoryConfig.bgColor, categoryConfig.color,
                      )}>
                        <HugeiconsIcon icon={categoryConfig.icon} strokeWidth={2} className="size-2.5" />
                        {entry.category}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-semibold tabular-nums shrink-0",
                    isIncome ? "text-green-600 dark:text-green-400" : "text-red-900 dark:text-red-500",
                  )}>
                    {isIncome ? "+" : "-"}{formatCompactAmount(entry.nominal, format)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDay && (!selectedDayData || !hasFilteredEntries) && (
        <div className="flex items-center justify-center rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">
            Tidak ada catatan tanggal {selectedDay.toLocaleDateString("id-ID", { day: "numeric", month: "long" })}
          </p>
        </div>
      )}

      {!selectedDay && (
        <div className="flex items-center justify-center rounded-lg border p-6">
          <p className="text-sm text-muted-foreground">Pilih tanggal untuk melihat catatan</p>
        </div>
      )}

      {editingEntry && (
        <CashflowFormDrawer
          mode="edit"
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
        />
      )}
    </div>
  );
}
