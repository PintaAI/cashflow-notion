"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  AiGameIcon,
  Analytics01Icon,
  ArrowDown01Icon,
  BookEditIcon,
  File01Icon,
  Home02Icon,
  Shield01Icon,
  UserCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent as UISidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { CashflowFormDrawer } from "@/components/entries";
import { checkAdminStatus } from "@/app/actions/admin";
import { getUserManagements, switchManagement } from "@/app/actions/management";
import { getManagementImageSrc } from "@/lib/management-image";
import { cashflowTools } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { useAppTab } from "@/components/providers/app-tab-provider";

export type AppTab = "home" | "catatan" | "summary" | "setting";

export const navItems = [
  { value: "home" as const, label: "Home", icon: Home02Icon },
  { value: "catatan" as const, label: "Catatan", icon: File01Icon },
  { value: "summary" as const, label: "Summary", icon: Analytics01Icon },
  { value: "setting" as const, label: "Setting", icon: UserCircleIcon },
];

const WALLET_CACHE_KEY = "cashflow_wallets";
const publicTools = cashflowTools.filter((tool) => tool.id !== "transfer");
const transferTool = cashflowTools.find((tool) => tool.id === "transfer");

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

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ managementId?: string }>();
  const searchParams = useSearchParams();
  const managementId = params.managementId;
  const { setActiveTab } = useAppTab();
  const { setOpenMobile } = useSidebar();

  const [isAdmin, setIsAdmin] = useState(false);
  const [managements, setManagements] = useState<UserManagements>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const managementPath = params.managementId ? `/dompet/${params.managementId}` : "/";
  const managementToolsPath = params.managementId ? `/dompet/${params.managementId}/tools` : null;
  const toolsPath = "/tools";
  const notesPath = "/notes";
  const statiePath = "/statie";

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
  const isOnNotes = pathname === notesPath;
  const isOnStatie = pathname.startsWith(statiePath);
  const isOnPublicTools = pathname === toolsPath;
  const isOnTransferTool = Boolean(managementToolsPath && pathname === managementToolsPath && searchParams.get("tool") === "transfer");
  const activeTool = searchParams.get("tool");
  const activeManagement = managements.find((m) => m.id === managementId) ?? managements.find((m) => m.isActive);
  const hasMultipleManagements = managements.length > 1;
  const activeImageSrc = getManagementImageSrc(activeManagement?.image);

  async function handleSwitchManagement(id: string) {
    setSwitcherOpen(false);
    setOpenMobile(false);

    setManagements((prev) => {
      const next = prev.map((m) => ({ ...m, isActive: m.id === id }));
      writeWalletCache(next);
      return next;
    });

    router.push(`/dompet/${id}`);
    router.refresh();
    void switchManagement(id).catch(console.error);
  }

  function handleNavClick(tab: AppTab) {
    setOpenMobile(false);
    if (pathname === managementPath) {
      setActiveTab(tab);
    }
  }

  function isTabActive(value: AppTab) {
    return value === "home"
      ? pathname === managementPath && currentTab === "home"
      : pathname === managementPath && currentTab === value;
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-r bg-background/95">
      <SidebarHeader className="px-3 pt-4 pb-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => hasMultipleManagements && setSwitcherOpen((open) => !open)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
              hasMultipleManagements && "hover:text-foreground"
            )}
            aria-disabled={!hasMultipleManagements}
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
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border bg-popover p-1.5 shadow-sm">
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
          <div className="mt-3">
            <CashflowFormDrawer
              mode="create"
              trigger={
                <Button className="w-full gap-2 rounded-lg">
                  <HugeiconsIcon
                    icon={Add01Icon}
                    strokeWidth={2.5}
                    className="size-4"
                  />
                  Tambah Catatan
                </Button>
              }
            />
          </div>
        )}
      </SidebarHeader>

      <UISidebarContent className="gap-3 px-3 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3">Cashflow</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {navItems.map((item) => {
              const href = item.value === "home" ? managementPath : `${managementPath}?tab=${item.value}`;
              const active = isTabActive(item.value);

              return (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    onClick={() => handleNavClick(item.value)}
                    className="h-10 rounded-lg px-3 text-sm data-active:bg-muted/70 data-active:font-medium"
                  >
                    <Link href={href}>
                      <HugeiconsIcon icon={item.icon} strokeWidth={2.1} className="size-4.5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.value === "home" && managementToolsPath && transferTool ? (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isOnTransferTool}
                          className="rounded-lg data-active:bg-muted/70 data-active:font-medium"
                        >
                          <Link href={`${managementToolsPath}?tool=transfer`} onClick={() => setOpenMobile(false)}>
                            <HugeiconsIcon icon={transferTool.icon} strokeWidth={2.1} className="size-4" />
                            <span>{transferTool.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-3">Tools</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isOnNotes}
                className="h-10 rounded-lg px-3 text-sm data-active:bg-muted/70 data-active:font-medium"
              >
                <Link href={notesPath} onClick={() => setOpenMobile(false)}>
                  <HugeiconsIcon icon={BookEditIcon} strokeWidth={2.1} className="size-4.5" />
                  <span>Notes</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isOnStatie}
                className="h-10 rounded-lg px-3 text-sm data-active:bg-muted/70 data-active:font-medium"
              >
                <Link href={statiePath} onClick={() => setOpenMobile(false)}>
                  <HugeiconsIcon icon={AiGameIcon} strokeWidth={2.1} className="size-4.5" />
                  <span>Statie</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {publicTools.map((tool) => {
              const isActiveTool = isOnPublicTools && (activeTool === tool.id || (!activeTool && tool.id === publicTools[0]?.id));

              return (
                <SidebarMenuItem key={tool.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActiveTool}
                    className="h-10 rounded-lg px-3 text-sm data-active:bg-muted/70 data-active:font-medium"
                  >
                    <Link
                      href={tool.id === publicTools[0]?.id ? toolsPath : `${toolsPath}?tool=${tool.id}`}
                      onClick={() => setOpenMobile(false)}
                    >
                      <HugeiconsIcon icon={tool.icon} strokeWidth={2.1} className="size-4.5" />
                      <span>{tool.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup className="p-0">
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isOnAdmin}
                  className="h-10 rounded-lg px-3 text-sm text-amber-600 data-active:bg-muted/70 data-active:font-medium dark:text-amber-500"
                >
                  <Link href="/admin" onClick={() => setOpenMobile(false)}>
                    <HugeiconsIcon icon={Shield01Icon} strokeWidth={2.1} className="size-4.5" />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </UISidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
