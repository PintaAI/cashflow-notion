"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { HomeTab, SummaryTab } from "@/components/dashboard";
import { CashflowFormDrawer, CatatanTab } from "@/components/entries";
import type { AppTab } from "@/components/layout";
import { SettingTab } from "@/components/settings";
import { Tabs, TabsContent } from "@/components/ui/tabs";

export function DashboardPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: AppTab =
    tabParam === "summary" || tabParam === "catatan" || tabParam === "setting"
      ? tabParam
      : "home";

  const [addDrawerOpen, setAddDrawerOpen] = useState(() => {
    return searchParams.get("action") === "add";
  });

  return (
    <>
      <CashflowFormDrawer mode="create" open={addDrawerOpen} onOpenChange={setAddDrawerOpen} />
      <Tabs value={activeTab}>
        <TabsContent value="home" className="mt-0">
          <HomeTab />
        </TabsContent>
        <TabsContent value="catatan" className="mt-0">
          <CatatanTab />
        </TabsContent>
        <TabsContent value="summary" className="mt-0">
          <SummaryTab />
        </TabsContent>
        <TabsContent value="setting" className="mt-0">
          <SettingTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
