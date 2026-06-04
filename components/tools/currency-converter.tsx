"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoneyExchange03Icon } from "@hugeicons/core-free-icons";
import { convertCurrency } from "@/app/actions/currency-converter";
import { formatCurrencyAmount, getCurrencyOption, SUPPORTED_CURRENCIES } from "@/lib/currency";
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
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("USD");
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
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Jumlah</p>
        <Input
          type="number"
          value={amount}
          onChange={handleAmountChange}
          min={0}
          step="any"
          placeholder="1"
          className="text-base"
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Dari</p>
          <Select value={from} onValueChange={handleFromChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Menghitung...</p>
        ) : result !== null ? (
          <>
            <p className="text-xs text-muted-foreground">Hasil</p>
            <p className="text-2xl font-semibold">
              {formatCurrencyAmount(result, to)}
            </p>
            {rate !== null && (
              <p className="text-xs text-muted-foreground">
                1 {getCurrencyOption(from).symbol}{from} = {formatCurrencyAmount(rate, to, { compact: true })} ·{" "}
                1 {getCurrencyOption(to).symbol}{to} = {formatCurrencyAmount(1 / rate, from, { compact: true })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Masukkan jumlah untuk mulai konversi</p>
        )}
      </div>
    </div>
  );
}
