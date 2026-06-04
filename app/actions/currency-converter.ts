"use server";

import { getAllRates } from "@/lib/exchange-rates";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const VALID_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<{ result: number; rate: number; rates: Record<string, number> }> {
  if (!VALID_CODES.has(from) || !VALID_CODES.has(to)) {
    throw new Error("Invalid currency code");
  }

  const rates = await getAllRates();
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;

  // rates are 1 IDR = X currency
  // amount_in_to = amount_in_from * (toRate / fromRate)
  const crossRate = toRate / fromRate;
  const result = amount * crossRate;

  return { result, rate: crossRate, rates };
}

export async function getAllCurrencyRates(): Promise<Record<string, number>> {
  return getAllRates();
}
