"use client";

import { Analytics01Icon, File01Icon, Home02Icon, UserCircleIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";

const navItems = [
  { value: "home", label: "Home", icon: Home02Icon },
  { value: "catatan", label: "Catatan", icon: File01Icon },
  { value: "summary", label: "Summary", icon: Analytics01Icon },
  { value: "profile", label: "Profile", icon: UserCircleIcon },
];

export function SidebarNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-background/95 px-4 py-5 md:flex md:flex-col">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.2} className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-none">Cashflow</p>
          <p className="mt-1 text-xs text-muted-foreground">Notion tracker</p>
        </div>
      </div>

      <TabsList
        variant="line"
        className="h-auto w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0"
      >
        {navItems.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="h-11 w-full justify-start gap-2 rounded-lg px-3 py-2 text-sm data-active:bg-muted/70"
          >
            <HugeiconsIcon icon={item.icon} strokeWidth={2.1} className="size-4.5" />
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </aside>
  );
}
