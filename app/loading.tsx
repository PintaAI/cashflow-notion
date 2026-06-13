import { ActivityHeatmapSkeleton, CashflowTableSkeleton, StatsSkeleton } from "@/components/utils";
import { PageHeader } from "@/components/layout";

export default function Loading() {
  return (
    <main className="container mx-auto py-4 sm:py-8 px-4 pb-24">
      <PageHeader title="Cashflow Tracker" showSidebarTrigger={false} />
      <StatsSkeleton />
      <ActivityHeatmapSkeleton />
      <CashflowTableSkeleton />
    </main>
  );
}
