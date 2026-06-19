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
import { formatCurrencyAmount } from "@/lib/currency";

export function WalletTransfer() {
  const queryClient = useQueryClient();
  const { managementId } = useManagement();
  const { currency, rates, option, toIdr } = useCurrency();
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
  const displayAmount = Number(amount);
  const hasDestinationWallets = destinationWallets.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toManagementId || !amount) return;

    setIsSubmitting(true);
    setStatus(null);
    setError(null);

    try {
      const nominal = Math.round(toIdr(Number(amount)));
      const sourceRate = currency === "IDR" ? 1 : (rates[currency] ?? 1);
      await transferBetweenManagements({
        fromManagementId: managementId,
        toManagementId,
        nominal,
        originalNominal: Number(amount),
        originalCurrency: currency,
        exchangeRateToIdr: currency === "IDR" ? 1 : 1 / sourceRate,
        exchangeRateAt: new Date(),
        note: note.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.activity(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot(managementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(toManagementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(toManagementId) });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.activity(toManagementId) });
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
      <div className="py-3 sm:py-4">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
            <HugeiconsIcon icon={MoneyExchange03Icon} strokeWidth={2} className="size-4" />
            Transfer Dompet
          </span>
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="truncate">{currentWallet?.name ?? "Dompet aktif"}</span>
            <span className="text-muted-foreground/40">→</span>
            <span className="truncate">
              {destinationWallets.find((wallet) => wallet.id === toManagementId)?.name ?? "Tujuan"}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <label className="sr-only" htmlFor="transfer-amount">Nominal</label>
            <input
              id="transfer-amount"
              inputMode="numeric"
              aria-label="Nominal transfer"
              placeholder={`${option.symbol} 0`}
              value={amount ? formatCurrencyAmount(displayAmount, currency) : ""}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="w-full min-w-0 bg-transparent p-0 text-2xl font-bold tracking-tight outline-none transition-all placeholder:text-muted-foreground/40 focus-visible:ring-0 sm:text-3xl md:text-4xl"
            />
            <p className="mt-1 text-xs text-muted-foreground/70">
              {amount ? `Akan dicatat sebagai transfer keluar dan masuk` : "Isi nominal transfer"}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y border-y">
        <div className="flex items-center gap-3 py-2.5">
          <p className="shrink-0 text-xs text-muted-foreground">Ke dompet</p>
          <Select value={toManagementId} onValueChange={setToManagementId} disabled={!hasDestinationWallets}>
            <SelectTrigger className="mx-1 h-8 min-w-0 flex-1 border-0 bg-muted/40 px-3 text-right shadow-none focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder={managementsQuery.isLoading ? "Memuat..." : "Pilih dompet"} />
            </SelectTrigger>
            <SelectContent>
              {destinationWallets.map((wallet) => (
                <SelectItem key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 py-2.5">
          <label className="shrink-0 text-xs text-muted-foreground" htmlFor="transfer-note">
            Catatan
          </label>
          <Input
            id="transfer-note"
            placeholder="opsional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mx-1 h-8 min-w-0 flex-1 border-0 bg-muted/40 px-3 text-sm shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
          />
        </div>
      </div>

      {!managementsQuery.isLoading && !hasDestinationWallets ? (
        <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
          Kamu belum tergabung di dompet lain.
        </p>
      ) : null}

      {status ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{status}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full gap-2"
        disabled={isSubmitting || !toManagementId || !amount || !hasDestinationWallets}
      >
        {isSubmitting ? "Menyimpan..." : "Simpan Transfer"}
        {!isSubmitting && <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />}
      </Button>
    </form>
  );
}
