import { Wallet01Icon } from "@hugeicons/core-free-icons";

import { ActivityHeatmapSkeleton, CashflowTableSkeleton, StatsSkeleton } from "@/components/loading-skeletons";
import { PageHeader } from "@/components/page-header";

export default function Loading() {
  return (
    <main className="container mx-auto py-4 sm:py-8 px-4 pb-24">
      <PageHeader icon={Wallet01Icon} title="Cashflow Tracker" />
      <StatsSkeleton />
      <ActivityHeatmapSkeleton />
      <CashflowTableSkeleton />
    </main>
  );
}
