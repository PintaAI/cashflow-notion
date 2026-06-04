"use client";


import { AnalyticsCharts } from "@/components/analytics-charts";
import { PageHeader } from "@/components/page-header";

export function SummaryTab() {
  return (
    <>
      <PageHeader title="Summary" />
      <AnalyticsCharts />
    </>
  );
}
