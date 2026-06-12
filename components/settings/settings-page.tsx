"use client";

import { useRef, useState, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { AiChat01Icon, BellDotIcon, ColorsIcon, Edit02Icon, FlashIcon, Logout01Icon, PercentIcon, RefreshIcon, Tag01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { getPalette } from "colorthief";

import { useSession, signOut } from "@/lib/auth-client";
import { useCurrency } from "@/components/providers/currency-provider"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"
import { PageHeader, ThemeToggle } from "@/components/layout";
import { ImageCropDialog } from "@/components/profile";
import { AuditDrawer, AuditStatusBar } from "@/components/audit";
import { CategoryManager, QuickFillManager, BudgetManager, RecurringManager, AppearanceSettings } from "@/components/settings";
import { ThemeSettings, getLocalThemes, saveLocalTheme } from "./theme-section";
import { ManagementSettings } from "./wallet-section";
import { McpKeySettings } from "./oauth-section";
import { DailyReminderPreference } from "./notification-section";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchProfileTheme, saveProfileTheme, updateProfile } from "@/app/actions/profile";
import type { ProfileActionState } from "@/app/actions/profile";
import { generateThemeFromSwatches, type GeneratedThemeColors } from "@/lib/theme-palettes";
import { getProfileImageSrc } from "@/lib/profile-image";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsSkeleton() {
  return (
    <>
      <PageHeader title="Setting">
        <ThemeToggle />
      </PageHeader>

      <div className="mb-4 rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 mb-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      <Skeleton className="mt-6 h-10 w-full rounded-lg" />
    </>
  );
}

export function SettingTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, refetch, isPending } = useSession();
  const { currency, setCurrency, loading } = useCurrency();
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<{ name: string; email: string; image: string | null } | null>(null);
  const sessionUser = session?.user ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  } : null;
  const visibleProfileUser = profileUser ?? sessionUser;
  const [name, setName] = useState(visibleProfileUser?.name ?? "");
  const [namePending, setNamePending] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const [themeMessage, setThemeMessage] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [nameState, setNameState] = useState<ProfileActionState>({ status: "idle", message: "" });
  const themeExtractionRef = useRef<Promise<GeneratedThemeColors | null> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setName(visibleProfileUser?.name ?? "");
    });
  }, [visibleProfileUser?.name]);

  async function extractThemeFromImageUrl(url: string) {
    const image = new window.Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    const palette = await getPalette(image, { colorCount: 6 });
    if (!palette) return null;
    return generateThemeFromSwatches(palette.map((c) => c.hex()));
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.currentTarget.value = "";
    setCropFile(file);
  }

  async function handleCropSave(croppedFile: File) {
    const previewUrl = URL.createObjectURL(croppedFile);
    setObjectPreviewUrl(previewUrl);
    setPhotoPending(true);
    setThemeMessage("Mengekstrak warna...");
    setNameState({ status: "idle", message: "" });

    let theme: GeneratedThemeColors | null = null;
    try {
      themeExtractionRef.current = extractThemeFromImageUrl(previewUrl);
      theme = await themeExtractionRef.current;
    } catch {
      theme = null;
    }

    const formData = new FormData();
    formData.set("name", name.trim() || visibleProfileUser?.name || "");
    formData.set("image", croppedFile);

    try {
      const result = await updateProfile({ status: "idle", message: "" }, formData);
      setNameState(result);
      if (result.status === "success" && result.user) {
        setProfileUser(result.user as { name: string; email: string; image: string | null });
        void refetch();
        if (theme) {
          saveLocalTheme({
            id: crypto.randomUUID(),
            name: `Profile theme ${new Date().toLocaleDateString("id-ID")}`,
            colors: theme,
            createdAt: new Date().toISOString(),
          });
          void saveProfileTheme(theme).catch(() => {});
        }
        setThemeMessage(theme ? "Foto dan tema tersimpan." : "Foto tersimpan.");
      }
    } finally {
      setPhotoPending(false);
      setObjectPreviewUrl(null);
    }
  }

  async function handleNameSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || name.trim() === visibleProfileUser?.name) return;
    setNamePending(true);
    setNameState({ status: "idle", message: "" });
    const formData = new FormData();
    formData.set("name", name.trim());
    try {
      const result = await updateProfile({ status: "idle", message: "" }, formData);
      setNameState(result);
      if (result.status === "success" && result.user) {
        setProfileUser(result.user as { name: string; email: string; image: string | null });
        void refetch();
        router.refresh();
      }
    } finally {
      setNamePending(false);
    }
  }

  const nameChanged = name.trim() !== visibleProfileUser?.name.trim();
  const defaultSection = searchParams.get("section") === "management" ? "management" : undefined;

  useEffect(() => {
    if (!session?.user?.id) return;
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

  if (isPending) return <SettingsSkeleton />;

  return (
    <>
      <PageHeader title="Setting">
        <ThemeToggle />
      </PageHeader>

      {visibleProfileUser && (
        <div className="mb-4 rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <label className="group relative cursor-pointer shrink-0" aria-label="Ganti foto profil">
              <Avatar className="size-9 text-sm font-semibold">
                {objectPreviewUrl ? (
                  <AvatarImage src={objectPreviewUrl} alt="Preview" />
                ) : getProfileImageSrc(visibleProfileUser.image) ? (
                  <AvatarImage src={getProfileImageSrc(visibleProfileUser.image)!} alt="Foto profil" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary">
                  {visibleProfileUser.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
                <AvatarBadge className="right-0 bottom-0 size-4 border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
                  {photoPending ? (
                    <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-2.5 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-2.5" />
                  )}
                </AvatarBadge>
              </Avatar>
              <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" disabled={photoPending} />
            </label>
            <form onSubmit={handleNameSubmit} className="flex-1 min-w-0">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={80}
                disabled={namePending || photoPending}
                className="h-auto border-none bg-transparent p-0 text-sm font-medium text-foreground shadow-none focus-visible:ring-0"
              />
              <p className="text-xs text-muted-foreground truncate">{visibleProfileUser.email}</p>
              {nameChanged && (
                <div className="mt-1 flex gap-1">
                  <Button type="submit" size="sm" disabled={namePending || name.trim().length < 2}>
                    {namePending ? "..." : "Simpan"}
                  </Button>
                </div>
              )}
            </form>
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
          <ImageCropDialog
            open={cropFile !== null}
            file={cropFile}
            onClose={() => setCropFile(null)}
            onSave={handleCropSave}
          />
          {themeMessage && (
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{themeMessage}</p>
          )}
          {nameState.message && (
            <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{nameState.message}</p>
          )}
        </div>
      )}

      <Accordion type="single" collapsible defaultValue={defaultSection} className="space-y-2 sm:space-y-3">
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

        <AccordionItem value="appearance">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={ColorsIcon} strokeWidth={2} className="size-4" />
              Tampilan
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <AppearanceSettings />
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
