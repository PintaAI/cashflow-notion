"use client";

import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarTrigger } from "@/components/layout";
import { CurrencyConverter } from "@/components/tools/currency-converter";
import { HabitTracker } from "@/components/tools/habit-tracker";
import { OvertimeTracker } from "@/components/tools/overtime-tracker";
import { SplitBills } from "@/components/tools/split-bills";
import { WalletTransfer } from "@/components/tools/wallet-transfer";
import { cashflowTools, type CashflowToolId } from "@/lib/tools";

const publicTools = cashflowTools.filter((tool) => tool.id !== "transfer");

export function ToolsPageContent({ includeTransfer = false }: { includeTransfer?: boolean }) {
  const searchParams = useSearchParams();
  const activeTool = searchParams.get("tool") as CashflowToolId | null;
  const visibleTools = includeTransfer ? cashflowTools : publicTools;
  const selectedTool = visibleTools.find((tool) => tool.id === activeTool) ?? visibleTools[0];

  function renderTool() {
    if (activeTool === "habbit-tracker") return <HabitTracker />;
    if (activeTool === "split-bills") return <SplitBills />;
    if (activeTool === "lembur") return <OvertimeTracker />;
    if (includeTransfer && activeTool === "transfer") return <WalletTransfer />;
    return <CurrencyConverter />;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <HugeiconsIcon icon={selectedTool.icon} strokeWidth={2} className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{selectedTool.label}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-md">
        {renderTool()}
      </div>
    </>
  );
}
