"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CalculatorIcon, MoneyReceiveIcon, MoneySendIcon, Wallet01Icon } from "@hugeicons/core-free-icons";

export interface StatsData {
  entryCount: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

interface StatsProps {
  stats: StatsData;
}

export function Stats({ stats }: StatsProps) {
  const formatCurrencyCompact = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      notation: "compact",
      compactDisplay: "short",
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 mb-4 sm:mb-6">
      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={CalculatorIcon}
            size={16}
            className="text-muted-foreground sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Entries</div>
        </div>
        <div className="text-lg sm:text-2xl font-bold">{stats.entryCount}</div>
      </div>
      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={MoneyReceiveIcon}
            size={16}
            className="text-green-600 sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Income</div>
        </div>
        <div
          className="text-base sm:text-2xl font-bold text-green-600 truncate"
          title={formatCurrencyFull(stats.totalIncome)}
        >
          {formatCurrencyCompact(stats.totalIncome)}
        </div>
      </div>
      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={MoneySendIcon}
            size={16}
            className="text-red-600 sm:w-5 sm:h-5"
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Expenses</div>
        </div>
        <div
          className="text-base sm:text-2xl font-bold text-red-600 truncate"
          title={formatCurrencyFull(stats.totalExpenses)}
        >
          {formatCurrencyCompact(stats.totalExpenses)}
        </div>
      </div>
      <div className="rounded-lg border p-2 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
          <HugeiconsIcon
            icon={Wallet01Icon}
            size={16}
            className={`sm:w-5 sm:h-5 ${
              stats.balance >= 0 ? "text-green-600" : "text-red-600"
            }`}
          />
          <div className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</div>
        </div>
        <div
          className={`text-base sm:text-2xl font-bold truncate ${
            stats.balance >= 0 ? "text-green-600" : "text-red-600"
          }`}
          title={formatCurrencyFull(stats.balance)}
        >
          {formatCurrencyCompact(stats.balance)}
        </div>
      </div>
    </div>
  );
}