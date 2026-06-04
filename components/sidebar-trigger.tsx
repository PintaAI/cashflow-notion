"use client";

import { useContext } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { SidebarContext } from "@/components/providers/sidebar-provider";
import { cn } from "@/lib/utils";

export function SidebarTrigger({ className }: { className?: string }) {
  const ctx = useContext(SidebarContext);
  if (!ctx) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("md:hidden", className)}
      onClick={() => ctx.setIsOpen(true)}
    >
      <HugeiconsIcon icon={SidebarLeftIcon} strokeWidth={2} className="size-5" />
    </Button>
  );
}
