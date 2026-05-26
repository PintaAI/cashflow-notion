import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: IconSvgElement;
  title: string;
  children?: ReactNode;
}

export function PageHeader({ icon, title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4 sm:mb-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-9">
          <HugeiconsIcon icon={icon} strokeWidth={2.2} className="size-4.5 sm:size-5" />
        </span>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
