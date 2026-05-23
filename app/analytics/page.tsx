import { Suspense } from "react";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AnalyticsCharts } from "@/components/analytics-charts";
import {
  fetchAnalyticsFromURL,
  fetchCategories,
  type URLAnalyticsFilter,
} from "@/app/actions/analytics";
import type { IOType, CategoryType } from "@/lib/notion";

// Server component that reads URL params
async function AnalyticsContent({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; allTime?: string; io?: string; category?: string }> }) {
  const params = await searchParams;
  
  // Build URL filter from searchParams
  const urlFilter: URLAnalyticsFilter = {
    from: params.from,
    to: params.to,
    allTime: params.allTime === "true",
    io: params.io as IOType | undefined,
    category: params.category as CategoryType | undefined,
  };

  // Fetch analytics data and categories
  const analytics = await fetchAnalyticsFromURL(urlFilter);
  const categories = await fetchCategories();

  return (
    <AnalyticsCharts
      analytics={analytics}
      filters={{
        from: urlFilter.from,
        to: urlFilter.to,
        allTime: urlFilter.allTime,
        io: urlFilter.io,
        category: urlFilter.category,
      }}
      categories={categories}
    />
  );
}

// Page component - server component that reads searchParams
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; allTime?: string; io?: string; category?: string }>;
}) {
  return (
    <main className="container mx-auto py-4 sm:py-8 px-4 pb-24">
      <div className="mb-4 rounded-lg border border-l-4 border-l-primary bg-primary/5 px-4 py-3 shadow-sm sm:mb-6 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary shadow-xs sm:size-9">
            <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2.2} className="size-4.5 sm:size-5" />
          </span>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Analytics</h1>
        </div>
      </div>

      <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading analytics...</div>}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
