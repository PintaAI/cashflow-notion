"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Table01Icon } from "@hugeicons/core-free-icons";

import { CashflowTable, CashflowCalendar } from "@/components/entries";
import { PageHeader } from "@/components/layout";
import { cn } from "@/lib/utils"

export function CatatanTab() {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <>
      <div className="flex items-center justify-between">
        <PageHeader title="Catatan" />
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
