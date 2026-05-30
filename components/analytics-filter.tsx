"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilterIcon, Calendar01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { IOType, CategoryType } from "@/lib/db";

// Types
import type { DateRange } from "react-day-picker";

interface FilterDraft {
  range: DateRange;
  io: IOType | "all";
  category: CategoryType | "all";
  allTime: boolean;
}

interface PresetOption {
  key: string;
  label: string;
  allTime?: boolean;
  getRange: () => DateRange;
}

interface AnalyticsFilterProps {
  filters: {
    from?: string;
    to?: string;
    allTime?: boolean;
    io?: IOType;
    category?: CategoryType;
  };
  categories: string[];
  onFiltersChange: (filters: AnalyticsFilterProps["filters"]) => void;
}

// Helpers
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function sameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function moveNearestRangeEdge(from: Date, to: Date, date: Date): DateRange {
  if (date <= from) return { from: date, to };
  if (date >= to) return { from, to: date };
  const distFrom = Math.abs(date.getTime() - from.getTime());
  const distTo = Math.abs(to.getTime() - date.getTime());
  return distFrom <= distTo ? { from: date, to } : { from, to: date };
}

// Preset options
const presetOptions: PresetOption[] = [
  {
    key: "all-time",
    label: "All time",
    allTime: true,
    getRange: () => ({ from: undefined }),
  },
  {
    key: "today",
    label: "Today",
    getRange: () => ({ from: startOfToday(), to: startOfToday() }),
  },
  {
    key: "last-7-days",
    label: "7 days",
    getRange: () => ({ from: addDays(startOfToday(), -6), to: startOfToday() }),
  },
  {
    key: "this-month",
    label: "This month",
    getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  {
    key: "last-month",
    label: "Last month",
    getRange: () => {
      const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    },
  },
  {
    key: "last-3-months",
    label: "3 months",
    getRange: () => ({ from: addDays(startOfToday(), -90), to: startOfToday() }),
  },
  {
    key: "this-year",
    label: "This year",
    getRange: () => ({
      from: new Date(new Date().getFullYear(), 0, 1),
      to: new Date(new Date().getFullYear(), 11, 31),
    }),
  },
];

function getDraftFromFilters(filters: AnalyticsFilterProps["filters"]): FilterDraft {
  return {
    range: {
      from: filters.from ? parseDateKey(filters.from) : undefined,
      to: filters.to ? parseDateKey(filters.to) : undefined,
    },
    io: filters.io || "all",
    category: filters.category || "all",
    allTime: Boolean(filters.allTime),
  };
}

function getActivePreset(draft: FilterDraft): string | null {
  if (draft.allTime) return "all-time";
  if (!draft.range.from || !draft.range.to) return null;
  return (
    presetOptions.find((preset) => {
      if (preset.allTime) return false;
      const range = preset.getRange();
      return (
        range.from &&
        range.to &&
        sameDay(range.from, draft.range.from!) &&
        sameDay(range.to, draft.range.to!)
      );
    })?.key ?? null
  );
}

export function AnalyticsFilter({ filters, categories, onFiltersChange }: AnalyticsFilterProps) {
  const [open, setOpen] = React.useState(false);

  const initialDraft = React.useMemo(() => getDraftFromFilters(filters), [filters]);
  const [draft, setDraft] = React.useState<FilterDraft>(initialDraft);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(
    () => initialDraft.range.from ?? new Date()
  );

  // Reset draft when popover opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(initialDraft);
      setCalendarMonth(initialDraft.range.from ?? new Date());
    }
    setOpen(nextOpen);
  };

  // Select preset
  const selectPreset = (preset: PresetOption) => {
    const range = preset.getRange();
    setDraft((current) => ({
      range,
      io: current.io,
      category: current.category,
      allTime: Boolean(preset.allTime),
    }));
    if (range.from) setCalendarMonth(range.from);
  };

  // Custom range click logic
  const selectRangeDate = (date: Date) => {
    setDraft((current) => {
      if (!current.range.from || current.range.to || current.allTime) {
        if (current.range.from && current.range.to && !current.allTime) {
          return {
            ...current,
            range: moveNearestRangeEdge(current.range.from, current.range.to, date),
          };
        }
        return { ...current, allTime: false, range: { from: date } };
      }
      if (date < current.range.from) {
        return { ...current, range: { from: date, to: current.range.from } };
      }
      return { ...current, range: { from: current.range.from, to: date } };
    });
  };

  // Apply filters
  const canApply = draft.allTime || (draft.range.from && draft.range.to);

  const applyFilters = () => {
    if (!canApply) return;
    const nextFilters: AnalyticsFilterProps["filters"] = {};

    if (draft.allTime) {
      nextFilters.allTime = true;
    } else if (draft.range.from && draft.range.to) {
      nextFilters.from = toDateKey(draft.range.from);
      nextFilters.to = toDateKey(draft.range.to);
    }

    if (draft.io === "all") {
      delete nextFilters.io;
    } else {
      nextFilters.io = draft.io;
    }

    if (draft.category === "all") {
      delete nextFilters.category;
    } else {
      nextFilters.category = draft.category;
    }

    onFiltersChange(nextFilters);
    setOpen(false);
  };

  // Reset draft
  const resetDraft = () => {
    setDraft({
      range: { from: undefined, to: undefined },
      io: "all",
      category: "all",
      allTime: false,
    });
    setCalendarMonth(new Date());
  };

  // Active preset
  const activePreset = getActivePreset(draft);

  // Calendar key for re-mount
  const calendarKey = draft.allTime
    ? "all-time"
    : `${toDateKey(draft.range.from ?? new Date())}-${toDateKey(draft.range.to ?? new Date())}`;

  // Display text for trigger button
  const getDisplayText = () => {
    if (filters.allTime) return "All time";
    if (filters.from && filters.to) {
      const from = parseDateKey(filters.from);
      const to = parseDateKey(filters.to);
      return `${formatDate(from)} - ${formatDate(to)}`;
    }
    return "Filter period";
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="size-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-80 gap-4 p-4">
        <PopoverHeader>
          <PopoverTitle>Filter Analytics</PopoverTitle>
          <PopoverDescription>Select period and filters.</PopoverDescription>
        </PopoverHeader>

        {/* Presets */}
        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-3" /> Preset period
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                {activePreset ? presetOptions.find(p => p.key === activePreset)?.label : "Select preset"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Quick presets</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presetOptions.map((preset) => (
                <DropdownMenuItem
                  key={preset.key}
                  onClick={() => selectPreset(preset)}
                  className={activePreset === preset.key ? "bg-accent" : ""}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </section>

        {/* Custom Range Calendar */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Custom range</p>
          <Calendar
            key={calendarKey}
            mode="range"
            selected={draft.allTime ? undefined : (draft.range.from || draft.range.to ? draft.range : undefined)}
            onDayClick={selectRangeDate}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            numberOfMonths={1}
            className="rounded-md border"
          />
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {draft.allTime
              ? "All data from the beginning."
              : draft.range.from && draft.range.to
                ? `${formatDate(draft.range.from)} - ${formatDate(draft.range.to)}`
                : draft.range.from
                  ? `${formatDate(draft.range.from)} - select end date`
                  : "Select start and end dates."}
          </p>
        </section>

        {/* Type Filter */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Type</p>
          <Select
            value={draft.io}
            onValueChange={(v) => setDraft((c) => ({ ...c, io: v as IOType | "all" }))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="Income">Income</SelectItem>
              <SelectItem value="Expenses">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {/* Category Filter */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Category</p>
          <Select
            value={draft.category}
            onValueChange={(v) => setDraft((c) => ({ ...c, category: v as CategoryType | "all" }))}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="sm" onClick={resetDraft}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={applyFilters} disabled={!canApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
