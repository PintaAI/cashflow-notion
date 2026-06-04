"use client";

import { useSearchParams } from "next/navigation";

import { CashflowFormDrawer } from "@/components/cashflow-form-drawer";
import { HomeTab } from "@/components/tabs/home";
import { CatatanTab } from "@/components/tabs/catatan";
import { SummaryTab } from "@/components/tabs/summary";
import { SettingTab } from "@/components/tabs/setting";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { AppTab } from "@/components/sidebar-content";
import { useState } from "react";

export default function HomePage() {
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
