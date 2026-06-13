"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/layout";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
  showSidebarTrigger?: boolean;
}

export function PageHeader({ title, children, showSidebarTrigger = true }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <div className="flex items-center gap-2">
        {showSidebarTrigger && <SidebarTrigger />}
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
