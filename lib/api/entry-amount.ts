import { getIdrRate } from "@/lib/exchange-rates";

type EntryAmountBody = {
  nominal?: unknown;
  originalNominal?: unknown;
  originalCurrency?: unknown;
  exchangeRateToIdr?: unknown;
  exchangeRateAt?: unknown;
};

export type NormalizedEntryAmount = {
  nominal?: number;
  originalNominal?: number;
  originalCurrency?: string;
  exchangeRateToIdr?: number;
  exchangeRateAt?: Date;
};

function asPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

export async function normalizeEntryAmount(body: EntryAmountBody): Promise<NormalizedEntryAmount> {
  const nominal = asPositiveNumber(body.nominal);
  const originalNominal = asPositiveNumber(body.originalNominal);
  const originalCurrency = typeof body.originalCurrency === "string" && body.originalCurrency.trim()
    ? body.originalCurrency.trim().toUpperCase()
    : undefined;
  const exchangeRateToIdr = asPositiveNumber(body.exchangeRateToIdr);
  const exchangeRateAt = body.exchangeRateAt ? new Date(String(body.exchangeRateAt)) : undefined;

  if (!originalNominal || !originalCurrency) {
    return {
      ...(nominal !== undefined ? { nominal } : {}),
      ...(originalNominal !== undefined ? { originalNominal } : {}),
      ...(originalCurrency !== undefined ? { originalCurrency } : {}),
      ...(exchangeRateToIdr !== undefined ? { exchangeRateToIdr } : {}),
      ...(exchangeRateAt && !Number.isNaN(exchangeRateAt.getTime()) ? { exchangeRateAt } : {}),
    };
  }

  const sourceRate = originalCurrency === "IDR" ? 1 : await getIdrRate(originalCurrency);
  const resolvedExchangeRateToIdr = exchangeRateToIdr ?? (sourceRate === 0 ? 1 : 1 / sourceRate);
  const resolvedNominal = nominal ?? Math.round(originalNominal * resolvedExchangeRateToIdr);

  return {
    nominal: resolvedNominal,
    originalNominal,
    originalCurrency,
    exchangeRateToIdr: resolvedExchangeRateToIdr,
    exchangeRateAt: exchangeRateAt && !Number.isNaN(exchangeRateAt.getTime()) ? exchangeRateAt : new Date(),
  };
}
