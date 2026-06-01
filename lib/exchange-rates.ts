import "server-only";

import { Redis } from "@upstash/redis";

const RATES_CACHE_KEY = "currency:idr-rates";
const FALLBACK_TTL_SECONDS = 60 * 60 * 24; // 24h

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export async function getIdrRates(): Promise<Record<string, number>> {
  const cached = await redis?.get<Record<string, number>>(RATES_CACHE_KEY);
  if (cached && cached.USD) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=IDR",
      { next: { revalidate: 3600 }, signal: controller.signal },
    );

    if (!response.ok) {
      throw new Error(`Exchange rate request failed: ${response.status}`);
    }

    const payload = (await response.json()) as { rates: Record<string, number> };
    const rates = payload.rates ?? {};

    if (!rates.USD) {
      throw new Error("Invalid exchange rate payload");
    }

    await redis?.set(RATES_CACHE_KEY, rates, { ex: FALLBACK_TTL_SECONDS });
    return rates;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getIdrRate(targetCurrency: string): Promise<number> {
  if (targetCurrency === "IDR") {
    return 1;
  }

  const rates = await getIdrRates();
  return rates[targetCurrency] ?? 1;
}

export async function getAllRates(): Promise<Record<string, number>> {
  const rates = await getIdrRates();
  return { IDR: 1, ...rates };
}
