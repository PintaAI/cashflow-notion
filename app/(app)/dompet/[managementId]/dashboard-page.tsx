"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { HomeTab, SummaryTab } from "@/components/dashboard";
import { CashflowFormDrawer, CatatanTab } from "@/components/entries";
import { useAppTab } from "@/components/providers/app-tab-provider";
import { SettingTab } from "@/components/settings";

export function DashboardPage() {
  const searchParams = useSearchParams();
  const { activeTab } = useAppTab();

  const [addDrawerOpen, setAddDrawerOpen] = useState(() => {
    return searchParams.get("action") === "add";
  });

  return (
    <>
      <CashflowFormDrawer mode="create" open={addDrawerOpen} onOpenChange={setAddDrawerOpen} />
      {activeTab === "home" && <HomeTab />}
      {activeTab === "catatan" && <CatatanTab />}
      {activeTab === "summary" && <SummaryTab />}
      {activeTab === "setting" && <SettingTab />}
    </>
  );
}
