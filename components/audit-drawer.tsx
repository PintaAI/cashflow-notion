"use client";

import * as React from "react";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Audit01Icon,
  CheckListIcon,
  Tick02Icon,
  Alert02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBalance, useLatestAudit, usePerformAudit } from "@/hooks/use-cashflow-data";
import { useCurrency } from "@/components/providers/currency-provider";
import { cn } from "@/lib/utils";

interface AuditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditDrawer({ open, onOpenChange }: AuditDrawerProps) {
  const { format } = useCurrency();
  const { data: expectedBalance, isLoading: balanceLoading } = useBalance();
  const { data: latestAudit } = useLatestAudit();
  const performAudit = usePerformAudit();

  const [actualInput, setActualInput] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const actualBalance = actualInput ? Number(actualInput) : null;
  const diff = actualBalance !== null && expectedBalance !== undefined
    ? actualBalance - expectedBalance
    : null;
  const hasDiff = diff !== null && Math.abs(diff) > 0.01;
  const isMatch = diff !== null && Math.abs(diff) < 0.01;

  const handleSaveOnly = async () => {
    if (actualBalance === null) return;
    setSubmitted(true);
    try {
      await performAudit.mutateAsync({
        actualBalance,
        note: note || undefined,
        autoAdjust: false,
      });
      setActualInput("");
      setNote("");
      onOpenChange(false);
    } catch {
      setSubmitted(false);
    }
  };

  const handleSaveAndAdjust = async () => {
    if (actualBalance === null) return;
    setSubmitted(true);
    try {
      await performAudit.mutateAsync({
        actualBalance,
        note: note || undefined,
        autoAdjust: true,
      });
      setActualInput("");
      setNote("");
      onOpenChange(false);
    } catch {
      setSubmitted(false);
    }
  };

  const busy = submitted || performAudit.isPending || balanceLoading;

  const lastAuditDate = latestAudit?.date
    ? new Date(latestAudit.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const lastMatch = latestAudit && Math.abs(latestAudit.difference) < 0.01;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Audit01Icon} strokeWidth={2} className="size-5" />
            Audit Saldo
          </DrawerTitle>
          <DrawerDescription>
            Bandingkan saldo tercatat dengan saldo sebenarnya
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Saldo tercatat</span>
              {balanceLoading ? (
                <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-base font-bold">{format(expectedBalance ?? 0)}</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Saldo sebenarnya</label>
            <Input
              type="number"
              placeholder="0"
              value={actualInput}
              onChange={(e) => setActualInput(e.target.value)}
              disabled={busy}
              className="text-base h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Catatan (opsional)</label>
            <Input
              placeholder="Misal: gaji belum dicatat"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
          </div>

          {diff !== null && (
            <div className={cn(
              "rounded-lg border p-3",
              isMatch
                ? "border-green-500/50 bg-green-500/10"
                : "border-amber-500/50 bg-amber-500/10",
            )}>
              {isMatch ? (
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Saldo sesuai!
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Selisih: {format(diff)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
                    {diff > 0 ? "Saldo sebenarnya lebih tinggi" : "Saldo tercatat lebih tinggi"}
                  </p>
                </div>
              )}
            </div>
          )}

          {lastAuditDate && (
            <p className="text-[10px] text-muted-foreground">
              Audit terakhir: {lastAuditDate}
              {lastMatch ? " \u2714 Sesuai" : latestAudit?.adjusted ? " \u2696 Disesuaikan" : ""}
            </p>
          )}
        </div>

        <DrawerFooter>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSaveOnly}
              disabled={busy || actualBalance === null}
            >
              {busy ? (
                <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
              ) : (
                <HugeiconsIcon icon={CheckListIcon} strokeWidth={2} className="size-4" />
              )}
              Simpan Audit
            </Button>
            {hasDiff && (
              <Button
                variant="default"
                className="flex-1"
                onClick={handleSaveAndAdjust}
                disabled={busy}
              >
                {busy ? (
                  <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
                )}
                Simpan & Sesuaikan
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
