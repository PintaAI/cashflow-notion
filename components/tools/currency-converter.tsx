"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoneyExchange03Icon } from "@hugeicons/core-free-icons";
import { convertCurrency } from "@/app/actions/currency-converter";
import { formatCurrencyAmount, getCurrencyOption, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ConversionHistoryItem = {
  id: string;
  amount: string;
  from: string;
  to: string;
  result: number;
  rate: number;
  time: string;
};

export function CurrencyConverter() {
  const { currency: userCurrency } = useCurrency();
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState(userCurrency);
  const [to, setTo] = useState("IDR");
  const [result, setResult] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [history, setHistory] = useState<ConversionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const parsed = Number.parseFloat(amount);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setResult(null);
        setRate(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await convertCurrency(parsed, from, to);
        if (cancelled) return;
        setResult(data.result);
        setRate(data.rate);
        setHistory((prev) => [
          {
            id: `${Date.now()}-${from}-${to}`,
            amount,
            from,
            to,
            result: data.result,
            rate: data.rate,
            time: new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
          },
          ...prev,
        ].slice(0, 5));
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [amount, from, to]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setAmount(next);
  }

  function handleFromChange(next: string) {
    setFrom(next);
  }

  function handleToChange(next: string) {
    setTo(next);
  }

  function handleSwap() {
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
  }

  return (
    <div className="space-y-5">
      <div className="py-3 sm:py-4">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
            Cek Krus
          </span>
          {rate !== null && (
            <div className="min-w-0 text-right text-[11px] leading-snug text-muted-foreground/75">
              <p className="truncate">1 {from} = {formatCurrencyAmount(rate, to, { compact: true })}</p>
              <p className="truncate">1 {to} = {formatCurrencyAmount(1 / rate, from, { compact: true })}</p>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {loading ? (
              <div className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl text-muted-foreground animate-pulse">
                Ngitung...
              </div>
            ) : result !== null ? (
              <>
                <div
                  className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl"
                  title={formatCurrencyAmount(result, to)}
                >
                  {formatCurrencyAmount(result, to)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {amount} {getCurrencyOption(from).symbol}{from}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight text-muted-foreground/40 transition-all sm:text-3xl md:text-4xl">
                  —
                </div>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Isi nominal
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span>{from}</span>
            <span className="text-muted-foreground/40">→</span>
            <span>{to}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Dari</p>
          <Select value={from} onValueChange={handleFromChange}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span>{c.flag} {c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="icon" className="mb-0 h-9 w-9 shrink-0" onClick={handleSwap}>
          <HugeiconsIcon icon={MoneyExchange03Icon} strokeWidth={2} className="size-4" />
        </Button>

        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Ke</p>
          <Select value={to} onValueChange={handleToChange}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span>{c.flag} {c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Nominal</p>
        <Input
          type="number"
          value={amount}
          onChange={handleAmountChange}
          min={0}
          step="any"
          placeholder="1"
          className="h-9 text-base"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">History</p>
          {history.length > 0 && (
            <p className="text-[11px] text-muted-foreground/60">5 terakhir</p>
          )}
        </div>
        {history.length > 0 ? (
          <div className="overflow-hidden rounded-lg border bg-muted/20">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b px-3 py-2.5 text-xs last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {item.amount} {getCurrencyOption(item.from).symbol}{item.from}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {item.time} · 1 {item.from} = {formatCurrencyAmount(item.rate, item.to, { compact: true })}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-foreground" title={formatCurrencyAmount(item.result, item.to)}>
                  {formatCurrencyAmount(item.result, item.to, { compact: true })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
            History konversi bakal muncul di sini.
          </div>
        )}
      </div>
    </div>
  );
}
