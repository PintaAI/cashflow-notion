"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Audit01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { useLatestAudit } from "@/hooks/use-cashflow-data";
import { cn } from "@/lib/utils";

interface AuditStatusBarProps {
  onAuditClick: () => void;
}

export function AuditStatusBar({ onAuditClick }: AuditStatusBarProps) {
  const { data: latestAudit, isLoading } = useLatestAudit();

  const lastAuditDate = latestAudit?.date
    ? new Date(latestAudit.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
    : null;

  const isMatch = latestAudit && Math.abs(latestAudit.difference) < 0.01;

  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <HugeiconsIcon
          icon={Audit01Icon}
          strokeWidth={2}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        {isLoading ? (
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3 animate-spin text-muted-foreground" />
        ) : lastAuditDate ? (
          <span className="text-xs text-muted-foreground truncate">
            Audit terakhir: {lastAuditDate}
            <span className={cn(
              "ml-1.5",
              isMatch ? "text-green-600" : latestAudit?.adjusted ? "text-amber-600" : "text-red-600"
            )}>
              {isMatch ? "\u2714 Sesuai" : latestAudit?.adjusted ? "\u2696 Disesuaikan" : "\u2716 Selisih"}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Belum pernah audit</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="xs"
        onClick={onAuditClick}
        className="shrink-0"
      >
        <HugeiconsIcon icon={Audit01Icon} strokeWidth={2} className="size-3" />
        Cek saldo
      </Button>
    </div>
  );
}
