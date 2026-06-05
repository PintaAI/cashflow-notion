"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { AiChat01Icon, BellDotIcon, Edit02Icon, FlashIcon, Logout01Icon, PercentIcon, RefreshIcon, Tag01Icon, UserCircleIcon, Wallet01Icon } from "@hugeicons/core-free-icons";

import { useSession, signOut } from "@/lib/auth-client";
import { useCurrency } from "@/components/providers/currency-provider"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"
import { PageHeader, ThemeToggle, LOCAL_THEME_CHANGED_EVENT } from "@/components/layout";
import type { LocalTheme } from "@/components/layout";
import { UserAvatar } from "@/components/profile";
import { AuditDrawer, AuditStatusBar } from "@/components/audit";
import { CategoryManager, QuickFillManager, BudgetManager, RecurringManager } from "@/components/settings";
import { ProfileEditor } from "./profile-section";
import { ThemeSettings, getLocalThemes, saveLocalTheme } from "./theme-section";
import { ManagementSettings } from "./wallet-section";
import { McpKeySettings } from "./oauth-section";
import { DailyReminderPreference } from "./notification-section";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchProfileTheme, saveProfileTheme } from "@/app/actions/profile";

export function SettingTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const { currency, setCurrency, loading } = useCurrency();
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<{ name: string; email: string; image: string | null } | null>(null);
  const sessionUser = session?.user ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  } : null;
  const visibleProfileUser = profileUser ?? sessionUser;

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetchProfileTheme()
      .then((theme) => {
        if (cancelled || !theme || getLocalThemes().length > 0) return;
        saveLocalTheme({
          id: crypto.randomUUID(),
          name: "Profile theme",
          colors: theme,
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return (
    <>
      <PageHeader title="Setting">
        <ThemeToggle />
      </PageHeader>

      {visibleProfileUser && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border p-3">
          <UserAvatar user={visibleProfileUser} size={36} className="size-9 shrink-0" fallbackClassName="bg-primary/10 text-sm font-semibold text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{visibleProfileUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{visibleProfileUser.email}</p>
          </div>
          <Select value={currency} onValueChange={setCurrency} disabled={loading}>
            <SelectTrigger className="w-fit gap-1 border-none bg-transparent p-0 text-xs font-medium text-muted-foreground shadow-none hover:text-foreground focus:ring-0 [&>span]:flex [&>span]:items-center [&>span]:gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span>{c.flag} {c.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Accordion type="single" collapsible className="space-y-2 sm:space-y-3">
        {visibleProfileUser && (
          <AccordionItem value="profile">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} className="size-4" />
                Profil
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ProfileEditor
                user={visibleProfileUser}
                onUpdated={(user, generatedTheme) => {
                  setProfileUser(user);
                  if (generatedTheme) {
                    saveLocalTheme({
                      id: crypto.randomUUID(),
                      name: `Profile theme ${new Date().toLocaleDateString("id-ID")}`,
                      colors: generatedTheme,
                      createdAt: new Date().toISOString(),
                    });
                    void saveProfileTheme(generatedTheme).catch(() => {});
                  }
                  router.refresh();
                }}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="theme">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
              Tema
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ThemeSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="management">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4" />
              Dompet
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ManagementSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="quick-fill">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={FlashIcon} strokeWidth={2} className="size-4" />
              Quick fill
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <QuickFillManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="categories">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} className="size-4" />
              Kategori
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <CategoryManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="budget">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={PercentIcon} strokeWidth={2} className="size-4" />
              Budget
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <BudgetManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="recurring">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
              Catat Otomatis
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <RecurringManager />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="reminder">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={BellDotIcon} strokeWidth={2} className="size-4" />
              Pengingat
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <DailyReminderPreference />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="connect-ai">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={AiChat01Icon} strokeWidth={2} className="size-4" />
              Hubungkan AI
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <McpKeySettings />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-4 mb-4">
        <AuditStatusBar onAuditClick={() => setAuditDrawerOpen(true)} />
      </div>

      <Button
        className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white"
        onClick={async () => {
          await signOut();
          window.location.href = "/auth";
        }}
      >
        <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4 mr-2" />
        Keluar
      </Button>
      <AuditDrawer open={auditDrawerOpen} onOpenChange={setAuditDrawerOpen} />
    </>
  );
}
