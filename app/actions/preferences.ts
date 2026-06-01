"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/management";
import { getAllRates } from "@/lib/exchange-rates";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const VALID_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export async function fetchUserCurrency(): Promise<string> {
  const session = await getSession();
  if (!session) return "IDR";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { currency: true },
  });

  return user?.currency ?? "IDR";
}

export async function updateUserCurrency(currency: string): Promise<void> {
  if (!VALID_CODES.has(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { currency },
  });
}

export async function fetchExchangeRates(): Promise<Record<string, number>> {
  return getAllRates();
}
