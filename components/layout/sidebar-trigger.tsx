"use client";

import { SidebarTrigger as UISidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function SidebarTrigger({ className }: { className?: string }) {
  return (
    <UISidebarTrigger
      className={cn("md:hidden", className)}
    />
  );
}
