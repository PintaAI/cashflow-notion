"use client";

import { Suspense } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar, MobileBottomNav, type AppTab } from "@/components/layout";
import { AppTabProvider, useAppTab } from "@/components/providers/app-tab-provider";
import { ManagementProvider } from "@/components/providers/management-provider";

function AppShellContent({
  children,
  managementId,
  managementPath,
  pathname,
}: {
  children: React.ReactNode;
  managementId?: string;
  managementPath: string;
  pathname: string;
}) {
  const { activeTab, setActiveTab } = useAppTab();
  const router = useRouter();

  function handleTabChange(tab: AppTab) {
    if (pathname === managementPath) {
      setActiveTab(tab);
      return;
    }

    const url = tab === "home" ? managementPath : `${managementPath}?tab=${tab}`;
    router.push(url);
  }

  return (
    <>
      <AppSidebar />

      <SidebarInset>
        <div className="mx-auto w-full max-w-7xl px-4 py-4 pb-24 sm:py-8 md:pb-8">
          {children}
        </div>
      </SidebarInset>

      {managementId && <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />}
    </>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ managementId?: string }>();
  const searchParams = useSearchParams();
  const managementId = params.managementId;
  const managementPath = managementId ? `/dompet/${managementId}` : "/";

  const shell = (
    <AppTabProvider key={`${pathname}?${searchParams.toString()}`} pathname={managementPath} searchParams={searchParams}>
      <AppShellContent managementId={managementId} managementPath={managementPath} pathname={pathname}>{children}</AppShellContent>
    </AppTabProvider>
  );

  if (managementId) {
    return <ManagementProvider managementId={managementId}>{shell}</ManagementProvider>;
  }

  return shell;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <SidebarProvider>
        <AppShell>{children}</AppShell>
      </SidebarProvider>
    </Suspense>
  );
}
