"use client";

import { Suspense } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarContent, MobileBottomNav, type AppTab } from "@/components/layout";
import { AppTabProvider, useAppTab } from "@/components/providers/app-tab-provider";
import { ManagementProvider } from "@/components/providers/management-provider";
import { SidebarProvider, useSidebar } from "@/components/providers/sidebar-provider";

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
  const { isOpen, setIsOpen } = useSidebar();
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
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" showCloseButton={true} className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="flex h-full flex-col px-4 py-5">
            <SidebarContent onNavigate={() => setIsOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-h-dvh w-full">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-background/95 px-4 py-5 md:flex md:flex-col">
          <SidebarContent />
        </aside>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 pb-24 sm:py-8 md:pb-8">
          {children}
        </main>
      </div>

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
