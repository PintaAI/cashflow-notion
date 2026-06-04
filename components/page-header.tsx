"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/sidebar-trigger";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
