"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchUserCurrency,
  updateUserCurrency,
  fetchExchangeRates,
} from "@/app/actions/preferences";
import {
  convertFromIdr,
  convertToIdr,
  formatCurrencyAmount,
  getDenominations,
  getCurrencyOption,
} from "@/lib/currency";
import type { CurrencyOption } from "@/lib/currency";

interface CurrencyContextValue {
  currency: string;
  option: CurrencyOption;
  rates: Record<string, number>;
  isIdr: boolean;
  loading: boolean;
  format: (amountIdr: number, opts?: { compact?: boolean }) => string;
  toIdr: (displayAmount: number) => number;
  toDisplay: (amountIdr: number) => number;
  setCurrency: (code: string) => Promise<void>;
  denominations: number[];
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState("IDR");
  const [rates, setRates] = useState<Record<string, number>>({ IDR: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [userCurrency, exchangeRates] = await Promise.all([
          fetchUserCurrency(),
          fetchExchangeRates(),
        ]);
        if (cancelled) return;
        setCurrencyState(userCurrency);
        setRates(exchangeRates);
      } catch {
        // defaults to IDR
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const rate = rates[currency] ?? 1;

  const format = useCallback(
    (amountIdr: number, opts?: { compact?: boolean }) => {
      const converted = convertFromIdr(amountIdr, currency, rate);
      return formatCurrencyAmount(converted, currency, { compact: opts?.compact });
    },
    [currency, rate],
  );

  const toIdr = useCallback(
    (displayAmount: number) => convertToIdr(displayAmount, currency, rate),
    [currency, rate],
  );

  const toDisplay = useCallback(
    (amountIdr: number) => convertFromIdr(amountIdr, currency, rate),
    [currency, rate],
  );

  const setCurrency = useCallback(async (code: string) => {
    await updateUserCurrency(code);
    setCurrencyState(code);
  }, []);

  const option = useMemo(() => getCurrencyOption(currency), [currency]);
  const denominations = useMemo(() => getDenominations(currency), [currency]);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      option,
      rates,
      isIdr: currency === "IDR",
      loading,
      format,
      toIdr,
      toDisplay,
      setCurrency,
      denominations,
    }),
    [currency, option, rates, loading, format, toIdr, toDisplay, setCurrency, denominations],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
