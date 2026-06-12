"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  File01Icon,
  Home02Icon,
  Shield01Icon,
  ToolsIcon,
  UserCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CashflowFormDrawer } from "@/components/entries";
import { checkAdminStatus } from "@/app/actions/admin";
import { getUserManagements, switchManagement } from "@/app/actions/management";
import { getManagementImageSrc } from "@/lib/management-image";
import { cashflowTools } from "@/lib/tools";
import { cn } from "@/lib/utils";

export type AppTab = "home" | "catatan" | "summary" | "setting";

export const navItems = [
  { value: "home" as const, label: "Home", icon: Home02Icon },
  { value: "catatan" as const, label: "Catatan", icon: File01Icon },
  { value: "summary" as const, label: "Summary", icon: Analytics01Icon },
  { value: "setting" as const, label: "Setting", icon: UserCircleIcon },
];

const WALLET_CACHE_KEY = "cashflow_wallets";

type UserManagements = Awaited<ReturnType<typeof getUserManagements>>;
type CachedWallet = Partial<UserManagements[number]> & { id: string; name: string };

function readWalletCache(managementId: string): UserManagements {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(WALLET_CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(cached)) return [];

    return cached.map((m: CachedWallet) => ({
      id: m.id,
      name: m.name,
      image: m.image ?? null,
      imageTheme: m.imageTheme ?? null,
      role: m.role ?? "",
      memberCount: m.memberCount ?? 0,
      isActive: m.id === managementId,
    })) as UserManagements;
  } catch {
    return [];
  }
}

function writeWalletCache(data: UserManagements) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage failures; wallet switching still works without cache.
  }
}

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ managementId?: string }>();
  const searchParams = useSearchParams();
  const managementId = params.managementId;
  const [isAdmin, setIsAdmin] = useState(false);
  const [managements, setManagements] = useState<UserManagements>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const managementPath = params.managementId ? `/dompet/${params.managementId}` : "/";
  const toolsPath = params.managementId ? `/dompet/${params.managementId}/tools` : "/tools";

  useEffect(() => {
    checkAdminStatus().then(setIsAdmin);
  }, []);

  useEffect(() => {
    if (!managementId) return;
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      const cached = readWalletCache(managementId);
      if (cached.length > 0) setManagements(cached);
    });

    getUserManagements(managementId).then((data) => {
      if (cancelled) return;

      setManagements(data);
      writeWalletCache(data);
    });

    return () => {
      cancelled = true;
    };
  }, [managementId]);

  const currentTab: AppTab =
    pathname === managementPath
      ? ((searchParams.get("tab") as AppTab) || "home")
      : "home";
  const isOnAdmin = pathname === "/admin";
  const isOnTools = pathname === toolsPath;
  const activeTool = searchParams.get("tool");
  const activeManagement = managements.find((m) => m.id === managementId) ?? managements.find((m) => m.isActive);
  const hasMultipleManagements = managements.length > 1;
  const activeImageSrc = getManagementImageSrc(activeManagement?.image);

  async function handleSwitchManagement(id: string) {
    setSwitcherOpen(false);
    onNavigate?.();

    setManagements((prev) => {
      const next = prev.map((m) => ({ ...m, isActive: m.id === id }));
      writeWalletCache(next);
      return next;
    });

    router.push(`/dompet/${id}`);
    router.refresh();
    void switchManagement(id).catch(console.error);
  }

  return (
    <>
      <div className="relative mb-6 px-1">
        <button
          type="button"
          onClick={() => hasMultipleManagements && setSwitcherOpen((open) => !open)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg py-2 text-left transition-colors",
            hasMultipleManagements && "hover:text-foreground"
          )}
          disabled={!hasMultipleManagements}
          aria-haspopup={hasMultipleManagements ? "menu" : undefined}
          aria-expanded={hasMultipleManagements ? switcherOpen : undefined}
        >
          <Avatar className="size-9">
            {activeImageSrc ? <AvatarImage src={activeImageSrc} alt="Foto dompet" /> : null}
            <AvatarFallback className="bg-muted text-muted-foreground">
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.1} className="size-4.5" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-none">
              {activeManagement?.name ?? "Cashflow"}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {activeManagement ? `${activeManagement.memberCount} anggota` : "Cashflow tracker"}
            </p>
          </div>
          {hasMultipleManagements && (
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className={cn("size-4 shrink-0 text-muted-foreground transition-transform", switcherOpen && "rotate-180")}
            />
          )}
        </button>

        {switcherOpen && hasMultipleManagements && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border bg-popover p-1.5 shadow-sm">
              {managements.map((m) => {
                const imageSrc = getManagementImageSrc(m.image);
                const isActiveManagement = m.id === activeManagement?.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSwitchManagement(m.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      isActiveManagement && "text-foreground"
                    )}
                  >
                    <Avatar size="sm">
                      {imageSrc ? <AvatarImage src={imageSrc} alt="Foto dompet" /> : null}
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.1} className="size-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-xs font-medium", isActiveManagement && "font-semibold")}>{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.memberCount} anggota · {m.role === "owner" ? "Pemilik" : "Anggota"}
                      </p>
                    </div>
                    {isActiveManagement && <span className="size-1.5 shrink-0 rounded-full bg-foreground" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
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

        {cashflowTools.map((tool) => {
          const isActiveTool = isOnTools && activeTool === tool.id;

          return (
            <Link
              key={tool.id}
              href={`${toolsPath}?tool=${tool.id}`}
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
