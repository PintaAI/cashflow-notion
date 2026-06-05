"use client";


import { AnalyticsCharts } from "@/components/dashboard";
import { PageHeader } from "@/components/layout";

export function SummaryTab() {
  return (
    <>
      <PageHeader title="Summary" />
      <AnalyticsCharts />
    </>
  );
}
