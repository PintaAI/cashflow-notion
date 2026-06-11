"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoneyExchange03Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { transferBetweenManagements } from "@/app/actions/cashflow";
import { getUserManagements } from "@/app/actions/management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/components/providers/currency-provider";
import { useManagement } from "@/components/providers/management-provider";
import { cashflowQueryKeys } from "@/hooks/use-cashflow-data";

export function WalletTransfer() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();
  const { currency, option, toIdr } = useCurrency();
  const [toManagementId, setToManagementId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const managementsQuery = useQuery({
    queryKey: ["user-managements", managementId],
    queryFn: () => getUserManagements(managementId),
  });
  const currentWallet = managementsQuery.data?.find((wallet) => wallet.id === managementId);
  const destinationWallets = (managementsQuery.data ?? []).filter((wallet) => wallet.id !== managementId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toManagementId || !amount) return;

    setIsSubmitting(true);
    setStatus(null);
    setError(null);

    try {
      const nominal = Math.round(toIdr(Number(amount)));
      await transferBetweenManagements({
        fromManagementId: managementId,
        toManagementId,
        nominal,
        note: note.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(toManagementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(toManagementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot(toManagementId) });

      const destination = destinationWallets.find((wallet) => wallet.id === toManagementId);
      setStatus(`Transfer tersimpan ke ${destination?.name ?? "dompet tujuan"}.`);
      setAmount("");
      setNote("");
      setToManagementId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <HugeiconsIcon icon={MoneyExchange03Icon} strokeWidth={2} className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Transfer antar dompet</p>
            <p className="text-xs text-muted-foreground">Dari {currentWallet?.name ?? "dompet aktif"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Dompet tujuan</p>
            <Select value={toManagementId} onValueChange={setToManagementId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Pilih dompet" />
              </SelectTrigger>
              <SelectContent>
                {destinationWallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {destinationWallets.length === 0 && (
              <p className="text-xs text-muted-foreground">Kamu belum tergabung di dompet lain.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Nominal</p>
            <Input
              inputMode="numeric"
              placeholder={`${option.symbol} 0`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground/70">Disimpan dalam nilai dasar {currency} kamu.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Catatan opsional</p>
            <Input
              placeholder="contoh: alokasi tabungan"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
      </div>

      {status && <p className="text-sm text-green-700 dark:text-green-300">{status}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="h-12 w-full gap-2"
        disabled={isSubmitting || !toManagementId || !amount || destinationWallets.length === 0}
      >
        {isSubmitting ? "Menyimpan..." : "Simpan Transfer"}
        {!isSubmitting && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-5" />}
      </Button>
    </form>
  );
}
