"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { SidebarContent, type AppTab } from "@/components/sidebar-content";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SidebarProvider, useSidebar } from "@/components/providers/sidebar-provider";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOpen, setIsOpen } = useSidebar();

  const currentTab: AppTab =
    pathname === "/"
      ? ((searchParams.get("tab") as AppTab) || "home")
      : "home";

  function handleTabChange(tab: AppTab) {
    const url = tab === "home" ? "/" : `/?tab=${tab}`;
    if (pathname === "/") {
      router.push(url, { scroll: false });
    } else {
      router.push(url);
    }
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" showCloseButton={true} className="w-72 p-0">
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

      <MobileBottomNav activeTab={currentTab} onTabChange={handleTabChange} />
    </>
  );
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
