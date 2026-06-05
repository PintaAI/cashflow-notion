export interface CurrencyOption {
  code: string;
  name: string;
  locale: string;
  symbol: string;
  flag: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "IDR", name: "Rupiah (Rp)", locale: "id-ID", symbol: "Rp", flag: "🇮🇩" },
  { code: "KRW", name: "Won (₩)", locale: "ko-KR", symbol: "₩", flag: "🇰🇷" },
  { code: "JPY", name: "Yen (¥)", locale: "ja-JP", symbol: "¥", flag: "🇯🇵" },
  { code: "VND", name: "Dong (₫)", locale: "vi-VN", symbol: "₫", flag: "🇻🇳" },
  { code: "USD", name: "US Dollar ($)", locale: "en-US", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro (€)", locale: "de-DE", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "Pound Sterling (£)", locale: "en-GB", symbol: "£", flag: "🇬🇧" },
  { code: "SGD", name: "Singapore Dollar (S$)", locale: "en-SG", symbol: "S$", flag: "🇸🇬" },
  { code: "AUD", name: "Australian Dollar (A$)", locale: "en-AU", symbol: "A$", flag: "🇦🇺" },
  { code: "MYR", name: "Ringgit (RM)", locale: "ms-MY", symbol: "RM", flag: "🇲🇾" },
  { code: "CNY", name: "Yuan (¥)", locale: "zh-CN", symbol: "¥", flag: "🇨🇳" },
  { code: "THB", name: "Baht (฿)", locale: "th-TH", symbol: "฿", flag: "🇹🇭" },
  { code: "PHP", name: "Peso (₱)", locale: "en-PH", symbol: "₱", flag: "🇵🇭" },
];

export const CURRENCY_DENOMINATIONS: Record<string, number[]> = {
  IDR: [1000, 2000, 5000, 10000, 20000, 50000, 100000],
  KRW: [1000, 2000, 5000, 10000, 20000, 50000, 100000],
  JPY: [1000, 2000, 5000, 10000, 20000, 50000, 100000],
  VND: [10000, 20000, 50000, 100000, 200000, 500000],
  USD: [1, 2, 5, 10, 20, 50, 100],
  EUR: [1, 2, 5, 10, 20, 50, 100],
  GBP: [1, 2, 5, 10, 20, 50, 100],
  SGD: [1, 2, 5, 10, 20, 50, 100],
  AUD: [1, 2, 5, 10, 20, 50, 100],
  MYR: [1, 5, 10, 20, 50, 100],
  THB: [20, 50, 100, 500, 1000],
  PHP: [20, 50, 100, 200, 500, 1000],
  CNY: [1, 5, 10, 20, 50, 100],
};

const NO_DECIMAL_CURRENCIES = new Set(["IDR", "KRW", "JPY", "VND"]);
const KJT_COMPACT_CURRENCIES = new Set(["KRW", "JPY", "VND"]);

export function getCurrencyOption(code: string): CurrencyOption {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0];
}

export function getCurrencyDecimals(code: string): number {
  return NO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
}

export function getDenominations(currencyCode: string): number[] {
  return CURRENCY_DENOMINATIONS[currencyCode] ?? CURRENCY_DENOMINATIONS.IDR;
}

export function convertFromIdr(amountIdr: number, targetCurrency: string, rate: number): number {
  if (targetCurrency === "IDR") return amountIdr;
  return amountIdr * rate;
}

export function convertToIdr(displayAmount: number, sourceCurrency: string, rate: number): number {
  if (sourceCurrency === "IDR") return displayAmount;
  if (rate === 0) return displayAmount;
  return displayAmount / rate;
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  options?: { compact?: boolean; locale?: string },
): string {
  const opt = getCurrencyOption(currencyCode);
  const locale = options?.locale ?? opt.locale;
  const compact = options?.compact ?? false;
  const fractionDigits = getCurrencyDecimals(currencyCode);

  if (compact && KJT_COMPACT_CURRENCIES.has(currencyCode)) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    if (abs >= 1_000_000) {
      const val = abs / 1_000_000;
      const formatted = val === Math.floor(val) ? val.toFixed(0) : val.toFixed(1);
      return `${sign}${opt.symbol}${formatted}jt`;
    }
    if (abs >= 1_000) {
      const val = abs / 1_000;
      const formatted = val === Math.floor(val) ? val.toFixed(0) : val.toFixed(1);
      return `${sign}${opt.symbol}${formatted}k`;
    }
    return `${sign}${opt.symbol}${Math.round(abs).toLocaleString(locale)}`;
  }

  if (compact) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 0,
      notation: "compact",
      compactDisplay: "short",
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
