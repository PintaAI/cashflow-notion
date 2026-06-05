"use client";

import { useRef, useState } from "react";
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

export function CurrencyConverter() {
  const { currency: userCurrency } = useCurrency();
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState(userCurrency);
  const [to, setTo] = useState("IDR");
  const [result, setResult] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleConvert(amt: string, src: string, dst: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const parsed = Number.parseFloat(amt);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setResult(null);
      setRate(null);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await convertCurrency(parsed, src, dst);
        setResult(data.result);
        setRate(data.rate);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setAmount(next);
    scheduleConvert(next, from, to);
  }

  function handleFromChange(next: string) {
    setFrom(next);
    scheduleConvert(amount, next, to);
  }

  function handleToChange(next: string) {
    setTo(next);
    scheduleConvert(amount, from, next);
  }

  function handleSwap() {
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
    scheduleConvert(amount, nextFrom, nextTo);
  }

  return (
    <div className="space-y-5">
      <div className="py-3 sm:py-4">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
            Convert Duit
          </span>
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

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Dari</p>
          <Select value={from} onValueChange={handleFromChange}>
            <SelectTrigger className="h-9">
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

        <Button variant="outline" size="icon" className="shrink-0 mb-0.5" onClick={handleSwap}>
          <HugeiconsIcon icon={MoneyExchange03Icon} strokeWidth={2} className="size-4" />
        </Button>

        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Ke</p>
          <Select value={to} onValueChange={handleToChange}>
            <SelectTrigger className="h-9">
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

      {rate !== null && (
        <div className="space-y-1 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p>1 {from} = {formatCurrencyAmount(rate, to, { compact: true })}</p>
          <p>1 {to} = {formatCurrencyAmount(1 / rate, from, { compact: true })}</p>
        </div>
      )}
    </div>
  );
}
