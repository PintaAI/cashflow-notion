import { fetchSummary } from "@/app/actions/cashflow";
import { CashflowTable } from "@/components/cashflow-table";
import { Stats, type StatsData } from "@/components/stats";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default async function HomePage() {
  // Fetch summary on the server (static data, good for SSR)
  const summary = await fetchSummary();

  // Transform summary to StatsData format
  const statsData: StatsData = {
    entryCount: summary.totalEntries,
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    balance: summary.balance,
  };

  return (
    <main className="container mx-auto py-4 sm:py-8 px-4 pb-24">
      <div className="mb-4 rounded-lg border border-l-4 border-l-primary bg-primary/5 px-4 py-3 shadow-sm sm:mb-6 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs sm:size-9">
            <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.2} className="size-4.5 sm:size-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Cashflow Tracker</h1>
        </div>
      </div>

      {/* Summary Cards */}
      <Stats stats={statsData} />

      {/* Table with infinite loading */}
      <CashflowTable />
    </main>
  );
}
