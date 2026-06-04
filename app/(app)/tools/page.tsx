"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CurrencyIcon,
  ReceiptDollarIcon,
  ToolsIcon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/sidebar-trigger";
import { CurrencyConverter } from "@/components/tools/currency-converter";
import { OvertimeTracker } from "@/components/tools/overtime-tracker";
import { SplitBills } from "@/components/tools/split-bills";

const tools = [
  {
    id: "converter",
    label: "Currency Converter",
    icon: CurrencyIcon,
  },
  {
    id: "split-bills",
    label: "Split Bills",
    icon: ReceiptDollarIcon,
  },
  {
    id: "lembur",
    label: "Lembur Tracker",
    icon: WorkHistoryIcon,
  },
] as const;

type ToolId = (typeof tools)[number]["id"];

export default function ToolsPage() {
  const searchParams = useSearchParams();
  const activeTool = searchParams.get("tool") as ToolId | null;
  const selectedTool = tools.find((t) => t.id === activeTool);

  function renderTool() {
    if (activeTool === "split-bills") return <SplitBills />;
    if (activeTool === "lembur") return <OvertimeTracker />;
    return <CurrencyConverter />;
  }

  if (selectedTool) {
    return (
      <>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-5" />
            </Link>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{selectedTool.label}</h1>
          </div>
          <HugeiconsIcon icon={selectedTool.icon} strokeWidth={2} className="size-5 text-muted-foreground" />
        </div>

        <div className="mx-auto max-w-md">
          {renderTool()}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tools">
        <HugeiconsIcon icon={ToolsIcon} strokeWidth={2} className="size-5 text-muted-foreground" />
      </PageHeader>

      <div className="grid grid-cols-4 gap-3">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            href={`/tools?tool=${tool.id}`}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="flex aspect-square w-full items-center justify-center rounded-xl border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
              <HugeiconsIcon icon={tool.icon} strokeWidth={1.5} className="size-10" />
            </div>
            <p className="text-center text-xs text-muted-foreground">{tool.label}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
