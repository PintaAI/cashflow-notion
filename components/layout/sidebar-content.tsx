"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Analytics01Icon,
  CurrencyIcon,
  File01Icon,
  Home02Icon,
  ReceiptDollarIcon,
  Shield01Icon,
  ToolsIcon,
  UserCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { CashflowFormDrawer } from "@/components/entries";
import { checkAdminStatus } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

export type AppTab = "home" | "catatan" | "summary" | "setting";

export const navItems = [
  { value: "home" as const, label: "Home", icon: Home02Icon },
  { value: "catatan" as const, label: "Catatan", icon: File01Icon },
  { value: "summary" as const, label: "Summary", icon: Analytics01Icon },
  { value: "setting" as const, label: "Setting", icon: UserCircleIcon },
];

const toolItems = [
  { value: "converter", label: "Convert Duit", icon: CurrencyIcon },
  { value: "split-bills", label: "Split Bills", icon: ReceiptDollarIcon },
] as const;

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const params = useParams<{ managementId?: string }>();
  const searchParams = useSearchParams();
  const managementPath = params.managementId ? `/dompet/${params.managementId}` : "/";
  const toolsPath = params.managementId ? `/dompet/${params.managementId}/tools` : "/tools";

  useEffect(() => {
    checkAdminStatus().then(setIsAdmin);
  }, []);

  const currentTab: AppTab =
    pathname === managementPath
      ? ((searchParams.get("tab") as AppTab) || "home")
      : "home";
  const isOnAdmin = pathname === "/admin";
  const isOnTools = pathname === toolsPath;
  const activeTool = searchParams.get("tool");

  return (
    <>
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon
            icon={Wallet01Icon}
            strokeWidth={2.2}
            className="size-5"
          />
        </span>
        <div>
          <p className="text-sm font-semibold leading-none">Cashflow</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cashflow tracker
          </p>
        </div>
      </div>

      {params.managementId && (
        <CashflowFormDrawer
          mode="create"
          trigger={
            <Button className="mb-4 w-full gap-2 rounded-xl">
              <HugeiconsIcon
                icon={Add01Icon}
                strokeWidth={2.5}
                className="size-4"
              />
              Tambah Catatan
            </Button>
          }
        />
      )}

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            item.value === "home"
              ? pathname === managementPath && currentTab === "home"
              : pathname === managementPath && currentTab === item.value;
          const href =
            item.value === "home" ? managementPath : `${managementPath}?tab=${item.value}`;

          return (
            <Link
              key={item.value}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/70",
                isActive && "bg-muted/70 font-medium"
              )}
            >
              <HugeiconsIcon
                icon={item.icon}
                strokeWidth={2.1}
                className="size-4.5"
              />
              {item.label}
            </Link>
          );
        })}

        <Link
          href={toolsPath}
          onClick={onNavigate}
          className={cn(
            "mt-1 flex h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/70",
            isOnTools && "bg-muted/70 font-medium"
          )}
        >
          <HugeiconsIcon
            icon={ToolsIcon}
            strokeWidth={2.1}
            className="size-4.5"
          />
          Tools
        </Link>

        {toolItems.map((tool) => {
          const isActiveTool = isOnTools && activeTool === tool.value;

          return (
            <Link
              key={tool.value}
              href={`${toolsPath}?tool=${tool.value}`}
              onClick={onNavigate}
              className={cn(
                "ml-4 flex h-9 w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                isActiveTool && "bg-muted/70 font-medium text-foreground"
              )}
            >
              <HugeiconsIcon
                icon={tool.icon}
                strokeWidth={2.1}
                className="size-4"
              />
              {tool.label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/70",
              isOnAdmin &&
                "bg-muted/70 font-medium text-amber-600 dark:text-amber-500"
            )}
          >
            <HugeiconsIcon
              icon={Shield01Icon}
              strokeWidth={2.1}
              className="size-4.5"
            />
            Admin
          </Link>
        )}
      </nav>
    </>
  );
}
