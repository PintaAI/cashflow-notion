"use client";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppTab } from "@/components/layout";

export const DEFAULT_TAB_KEY = "cashflow.defaultTab";

const TAB_OPTIONS: { value: AppTab; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "catatan", label: "Catatan" },
  { value: "summary", label: "Summary" },
  { value: "setting", label: "Setting" },
];

function getSavedDefaultTab(): AppTab {
  if (typeof window === "undefined") return "home";
  const saved = localStorage.getItem(DEFAULT_TAB_KEY);
  if (saved && TAB_OPTIONS.some((t) => t.value === saved)) return saved as AppTab;
  return "home";
}

export function AppearanceSettings() {
  const [defaultTab, setDefaultTab] = useState<AppTab>(getSavedDefaultTab);

  function handleChange(value: string) {
    const tab = value as AppTab;
    setDefaultTab(tab);
    localStorage.setItem(DEFAULT_TAB_KEY, tab);
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">Tab Awal</span>
      <Select value={defaultTab} onValueChange={handleChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TAB_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
