"use client";

import type { CreatorAnalytics } from "@/lib/analytics";
import { useCurrency } from "@/components/providers/currency-provider";
import { UserAvatar, getUserDisplayName } from "@/components/profile";

export function CreatorBreakdown({ creators }: { creators: CreatorAnalytics[] }) {
  const { format } = useCurrency();
  const maxExpenses = Math.max(...creators.map((creator) => creator.totalExpenses), 0);

  if (creators.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border p-3 sm:mb-6 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">By Member</h2>
          <p className="text-xs text-muted-foreground">Who added entries in this period</p>
        </div>
      </div>

      <div className="space-y-3">
        {creators.map((creator) => {
          const label = creator.userId ? getUserDisplayName(creator) : "Unknown/System";
          const width = maxExpenses > 0 ? Math.max((creator.totalExpenses / maxExpenses) * 100, 4) : 0;

          return (
            <div key={creator.userId ?? "unknown"} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <UserAvatar user={creator.userId ? creator : null} size={28} className="size-7" fallbackClassName="text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{creator.entryCount} entries</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-red-900 dark:text-red-500">
                    {format(creator.totalExpenses, { compact: true })}
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-400">
                    +{format(creator.totalIncome, { compact: true })}
                  </p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-red-500/70" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
