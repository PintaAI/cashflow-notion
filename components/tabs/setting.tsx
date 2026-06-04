"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { AiChat01Icon, BellDotIcon, CurrencyIcon, Delete02Icon, Edit02Icon, FlashIcon, Logout01Icon, PercentIcon, RefreshIcon, Tag01Icon, UserCircleIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { getPalette, getSwatches } from "colorthief";

import { useSession, signOut } from "@/lib/auth-client";
import { AuditDrawer } from "@/components/audit-drawer";
import { AuditStatusBar } from "@/components/audit-status-bar";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryManager } from "@/components/category-manager";
import { QuickFillManager } from "@/components/quick-fill-manager";
import { BudgetManager } from "@/components/budget-manager";
import { RecurringManager } from "@/components/recurring-manager";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCurrency } from "@/components/providers/currency-provider"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"
import { getProfileImageSrc } from "@/lib/profile-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  getCurrentManagement,
  createInvite,
  deleteInvite,
  getManagementInvitations,
  getUserManagements,
  removeManagementMember,
  switchManagement,
  renameManagement,
  createManagement,
  type ManagementInvitation,
  type ManagementWithMembers,
} from "@/app/actions/management";
import { listOAuthConnections, revokeOAuthConnection } from "@/app/actions/oauth";
import {
  fetchProfileTheme,
  saveProfileTheme,
  updateProfile,
  type ProfileActionState,
} from "@/app/actions/profile";
import type { UserOAuthConnection } from "@/lib/oauth/server";
import { cn } from "@/lib/utils"
import {
  generateThemeFromSwatches,
  parseThemeColors,
  type GeneratedThemeColors,
} from "@/lib/theme-palettes";
import {
  LOCAL_THEME_CHANGED_EVENT,
  LOCAL_THEMES_KEY,
  SELECTED_LOCAL_THEME_KEY,
  type LocalTheme,
} from "@/components/local-theme-style";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

function DailyReminderPreference() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      Promise.resolve().then(() => {
        setIsSupported(false);
        setMessage("Notifikasi push tidak didukung di browser ini.");
      });
      return;
    }
    Promise.resolve().then(() => setIsSupported(true));
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.pushManager.getSubscription().then((subscription) => {
        setIsEnabled(Boolean(subscription));
      });
    });
  }, []);

  async function enableReminder() {
    if (!vapidPublicKey) {
      setMessage("Notifikasi push belum dikonfigurasi.");
      return;
    }
    setIsBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Izin notifikasi tidak diberikan.");
        return;
      }
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
      }
      await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        throw new Error("Failed to save notification subscription");
      }
      setIsEnabled(true);
      setMessage("Aktif jam 20:00 WIB");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengaktifkan pengingat.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disableReminder() {
    setIsBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsEnabled(false);
      setMessage("Pengingat dimatikan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mematikan pengingat.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    if (message && !isBusy) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message, isBusy])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Pengingat harian</span>
        {message && !isBusy && (
          <span className="text-xs text-muted-foreground">{message}</span>
        )}
      </div>
      <Switch
        checked={isEnabled}
        disabled={!isSupported || isBusy}
        onCheckedChange={(checked) => {
          if (checked) {
            enableReminder()
          } else {
            disableReminder()
          }
        }}
      />
    </div>
  );
}

function ManagementSettings() {
  const { data: session } = useSession();
  const [management, setManagement] = useState<ManagementWithMembers | null>(null);
  const [managements, setManagements] = useState<Awaited<ReturnType<typeof getUserManagements>>>([]);
  const [invitations, setInvitations] = useState<ManagementInvitation[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    getCurrentManagement().then((m) => {
      if (m) {
        setManagement(m);
        setNameValue(m.management.name);
      }
    });
    getUserManagements().then(setManagements);
    getManagementInvitations()
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }

  useEffect(() => { load(); }, []);

  async function handleSwitch(id: string) {
    try {
      await switchManagement(id);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerateInvite() {
    setCreatingInvite(true);
    try {
      await createInvite();
      setInvitations(await getManagementInvitations());
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleDeleteInvite(invitationId: string) {
    setDeletingInviteId(invitationId);
    try {
      await deleteInvite(invitationId);
      setInvitations((prev) => prev.filter((invitation) => invitation.id !== invitationId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingInviteId(null);
    }
  }

  async function handleCopyInvite(invitationId: string, inviteLink: string) {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteId(invitationId);
      window.setTimeout(() => setCopiedInviteId(null), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingMemberId(memberId);
    try {
      await removeManagementMember(memberId);
      setManagement((prev) => prev
        ? {
            ...prev,
            management: {
              ...prev.management,
              members: prev.management.members.filter((member) => member.id !== memberId),
            },
          }
        : prev
      );
      setManagements(await getUserManagements());
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === management?.management.name) {
      setEditingName(false);
      setNameValue(management?.management.name ?? "");
      return;
    }
    setNameSaving(true);
    try {
      await renameManagement(trimmed);
      setManagement((prev) =>
        prev ? { ...prev, management: { ...prev.management, name: trimmed } } : prev
      );
    } catch (err) {
      setNameValue(management?.management.name ?? "");
      console.error(err);
    } finally {
      setNameSaving(false);
      setEditingName(false);
    }
  }

  async function handleCreate() {
    const trimmed = createName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await createManagement(trimmed);
      setCreateOpen(false);
      setCreateName("");
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  if (!management) return null;

  const isOwner = management.role === "owner";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCreateOpen(!createOpen)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-solid transition-colors"
        >
          + Buat Dompet Baru
        </button>
        {createOpen && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nama dompet"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              disabled={creating}
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? "..." : "Buat"}
            </Button>
          </div>
        )}
      </div>

      {managements.length > 0 && (
        <div className="space-y-1.5">
          {managements.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 transition-colors",
                m.isActive
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50 cursor-pointer"
              )}
              onClick={() => {
                if (!m.isActive) handleSwitch(m.id);
              }}
            >
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className={cn("size-4 shrink-0", m.isActive ? "text-primary" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                {editingName && m.isActive && isOwner ? (
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setEditingName(false);
                        setNameValue(management.management.name);
                      }
                    }}
                    onBlur={handleSaveName}
                    disabled={nameSaving}
                    className="w-full bg-transparent text-sm font-medium outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className={cn("text-sm font-medium truncate", m.isActive && "text-primary")}>{m.name}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {m.memberCount} anggota · {m.role === "owner" ? "Pemilik" : "Anggota"}
                </p>
              </div>
              {m.isActive && isOwner && !editingName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNameValue(management.management.name);
                    setEditingName(true);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3" />
                </button>
              )}
              {m.isActive && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Aktif</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium">Anggota</p>
        <div className="space-y-1.5">
          {management.management.members.map((member) => {
            const memberImageSrc = getProfileImageSrc(member.user.image);
            return (
            <div key={member.id} className="flex items-center gap-2 border border-border rounded p-2">
              {memberImageSrc ? (
                <Image src={memberImageSrc} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" unoptimized />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">
                  {member.user.name?.[0]?.toUpperCase() ?? member.user.email[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{member.user.name ?? member.user.email}</p>
                <p className="text-[10px] text-muted-foreground">{member.role === "owner" ? "Pemilik" : "Anggota"}</p>
              </div>
              {isOwner && member.role !== "owner" && member.user.id !== session?.user.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveMember(member.id)}
                  disabled={removingMemberId === member.id}
                >
                  {removingMemberId === member.id ? "Menghapus..." : "Hapus"}
                </Button>
              )}
            </div>
          );
          })}
        </div>
      </div>

      {isOwner && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Undangan</p>
            <Button size="sm" onClick={handleGenerateInvite} disabled={creatingInvite}>
              {creatingInvite ? "Membuat..." : "Buat Undangan"}
            </Button>
          </div>
          {invitations.length > 0 ? (
            <div className="space-y-1.5">
              {invitations.map((invitation) => {
                const isExpired = new Date(invitation.expiresAt) < new Date();
                const inviteLink = `${origin}/invite?code=${invitation.code}`;
                return (
                  <div key={invitation.id} className="space-y-2 rounded-md border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        invitation.status === "pending" && !isExpired
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isExpired ? "Kadaluarsa" : invitation.status === "pending" ? "Aktif" : "Digunakan"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteInvite(invitation.id)}
                        disabled={deletingInviteId === invitation.id}
                      >
                        {deletingInviteId === invitation.id ? "Menghapus..." : "Hapus"}
                      </Button>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 rounded bg-muted p-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {inviteLink}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyInvite(invitation.id, inviteLink)}
                      >
                        {copiedInviteId === invitation.id ? "Tersalin" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Dibuat {new Date(invitation.createdAt).toLocaleDateString("id-ID")} · Berlaku sampai {new Date(invitation.expiresAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Belum ada undangan.</p>
          )}
        </div>
      )}
    </div>
  );
}

function McpKeySettings() {
  const [connections, setConnections] = useState<UserOAuthConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    listOAuthConnections().then((conns) => {
      setConnections(conns);
      setLoadingConnections(false);
    });
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-semibold text-primary">Cara menghubungkan</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Buka <strong>ChatGPT</strong> → Settings → Apps &amp; Connectors → nyalakan <strong>Developer Mode</strong></li>
          <li>Buat <strong>App</strong> baru, beri nama (contoh: &quot;Cashflow&quot;)</li>
          <li>Tempel <strong>MCP Server URL</strong> di bawah, pilih auth <strong>OAuth</strong></li>
          <li>Login seperti biasa — Anda akan diarahkan ke halaman login Cashflow</li>
          <li>Kembali ke chat, panggil lewat ikon <strong>+</strong> atau ketik <strong>@Cashflow</strong></li>
        </ol>
        <p className="text-[10px] text-muted-foreground border-t border-primary/10 pt-2 mt-1">
          Untuk <strong>Cursor</strong>: Settings → Features → MCP → paste URL yang sama.<br />
          Untuk <strong>AI lain</strong> (Claude Desktop, VS Code, Cline, dll): tempel URL yang sama dan pilih OAuth — caranya kurang lebih sama.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-xs font-medium">Salin URL ini</p>
        <CopyField label="MCP Server URL" value={`${baseUrl}/api/mcp`} />
        <p className="text-xs text-muted-foreground">
          Tempel URL ini ke AI client pilihan Anda, lalu pilih &quot;OAuth&quot; sebagai metode login.
        </p>

        {loadingConnections ? (
          <p className="text-xs text-muted-foreground">Memuat koneksi...</p>
        ) : connections.length > 0 ? (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium">Terhubung sebagai</p>
            {connections.map((c) => (
              <div key={c.clientId} className="flex items-center justify-between rounded-md border p-2.5">
                <p className="text-sm font-medium truncate">{c.clientName}</p>
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-2 shrink-0 text-red-500 border-red-200 hover:bg-red-50"
                  disabled={revoking === c.clientId}
                  onClick={async () => {
                    setRevoking(c.clientId);
                    try {
                      await revokeOAuthConnection(c.clientId);
                      setConnections((prev) => prev.filter((x) => x.clientId !== c.clientId));
                    } finally {
                      setRevoking(null);
                    }
                  }}
                >
                  {revoking === c.clientId ? "..." : "Putuskan"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="relative">
        <pre className="bg-muted p-3 pr-20 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
          {value}
        </pre>
        <Button
          variant="outline"
          size="xs"
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}

type EditableProfileUser = {
  name: string;
  email: string;
  image: string | null;
};

const initialProfileState: ProfileActionState = {
  status: "idle",
  message: "",
};

function getLocalThemes(): LocalTheme[] {
  try {
    const rawThemes = window.localStorage.getItem(LOCAL_THEMES_KEY);
    if (!rawThemes) return [];
    const parsed = JSON.parse(rawThemes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalTheme(theme: LocalTheme) {
  const nextThemes = [theme, ...getLocalThemes().filter((item) => item.id !== theme.id)].slice(0, 5);
  window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
  window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, theme.id);
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
}

function subscribeLocalThemes(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange);
  };
}

function getLocalThemesSnapshot() {
  return window.localStorage.getItem(LOCAL_THEMES_KEY) ?? "[]";
}

function getSelectedLocalThemeSnapshot() {
  return window.localStorage.getItem(SELECTED_LOCAL_THEME_KEY) ?? "";
}

function getEmptyLocalThemesSnapshot() {
  return "[]";
}

function getEmptySelectedLocalThemeSnapshot() {
  return "";
}

function parseLocalThemesSnapshot(snapshot: string): LocalTheme[] {
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ProfileEditor({ user, onUpdated }: { user: EditableProfileUser; onUpdated: (user: EditableProfileUser, generatedTheme: GeneratedThemeColors | null) => void }) {
  const [name, setName] = useState(user.name);
  const [state, setState] = useState<ProfileActionState>(initialProfileState);
  const [namePending, setNamePending] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const [themeMessage, setThemeMessage] = useState("");
  const themeExtractionRef = useRef<Promise<GeneratedThemeColors | null> | null>(null);

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

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setObjectPreviewUrl(previewUrl);
    setPhotoPending(true);
    setThemeMessage("Mengekstrak warna...");
    setState({ status: "idle", message: "" });

    let theme: GeneratedThemeColors | null = null;
    try {
      themeExtractionRef.current = extractThemeFromImageUrl(previewUrl);
      theme = await themeExtractionRef.current;
    } catch {
      theme = null;
    }

    const formData = new FormData();
    formData.set("name", name.trim() || user.name);
    formData.set("image", file);

    try {
      const result = await updateProfile(initialProfileState, formData);
      setState(result);
      if (result.status === "success" && result.user) {
        onUpdated(result.user as EditableProfileUser, theme);
        setThemeMessage(theme ? "Foto dan tema tersimpan." : "Foto tersimpan.");
      }
    } finally {
      setPhotoPending(false);
      setObjectPreviewUrl(null);
      e.currentTarget.value = "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNamePending(true);
    setState({ status: "idle", message: "" });
    const formData = new FormData(e.currentTarget);
    try {
      const result = await updateProfile(initialProfileState, formData);
      setState(result);
      if (result.status === "success" && result.user) {
        onUpdated(result.user as EditableProfileUser, null);
      }
    } finally {
      setNamePending(false);
    }
  }

  const nameChanged = name.trim() !== user.name.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <label className="group relative cursor-pointer" aria-label="Ganti foto profil">
          {objectPreviewUrl ? (
            <Image src={objectPreviewUrl} alt="Preview" width={88} height={88} className="size-22 rounded-full object-cover" unoptimized />
          ) : getProfileImageSrc(user.image) ? (
            <Image src={getProfileImageSrc(user.image)!} alt="Foto profil" width={88} height={88} className="size-22 rounded-full object-cover" unoptimized />
          ) : (
            <div className="flex size-22 items-center justify-center rounded-full bg-primary/10 text-3xl font-semibold text-primary">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <span className="absolute right-0 bottom-1 flex size-7 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
            {photoPending ? (
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-3.5 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3.5" />
            )}
          </span>
          <input type="file" name="image" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={photoPending} />
        </label>
        <p className="text-xs text-muted-foreground">
          {photoPending ? "Menyimpan foto..." : themeMessage || "Klik foto untuk mengganti"}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Nama</p>
        <div className="flex gap-2">
          <Input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            disabled={namePending || photoPending}
            className="flex-1"
          />
          <Button type="submit" disabled={namePending || photoPending || !nameChanged || name.trim().length < 2}>
            {namePending ? "..." : "Simpan"}
          </Button>
        </div>
      </div>

      {state.message && <p className="text-xs text-muted-foreground" aria-live="polite">{state.message}</p>}
    </form>
  );
}

function ThemeSettings() {
  const themesSnapshot = useSyncExternalStore(subscribeLocalThemes, getLocalThemesSnapshot, getEmptyLocalThemesSnapshot);
  const selectedThemeSnapshot = useSyncExternalStore(subscribeLocalThemes, getSelectedLocalThemeSnapshot, getEmptySelectedLocalThemeSnapshot);
  const themes = parseLocalThemesSnapshot(themesSnapshot);
  const selectedThemeId = selectedThemeSnapshot || null;
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleThemeChange(value: string) {
    const nextThemeId = value === "default" ? null : value;
    setMessage("");
    startTransition(() => {
      if (nextThemeId) {
        window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, nextThemeId);
      } else {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
      setMessage("Tema berhasil diterapkan di perangkat ini.");
    });
  }

  function handleDeleteTheme(themeId: string) {
    setMessage("");
    startTransition(() => {
      const nextThemes = getLocalThemes().filter((theme) => theme.id !== themeId);
      window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
      if (selectedThemeId === themeId) {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
      setMessage("Tema dihapus.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Tema baru dibuat otomatis dari warna foto profil saat Anda mengunggah foto baru. Maksimal 5 tema disimpan di perangkat ini; tema tertua akan dihapus saat melewati batas.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleThemeChange("default")}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors hover:bg-accent/60",
            !selectedThemeId && "border-primary bg-primary/5"
          )}
          disabled={isPending}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">Tema bawaan</p>
            {!selectedThemeId && <span className="text-xs text-primary">Aktif</span>}
          </div>
          <div className="flex overflow-hidden rounded-md border">
            <span className="h-8 flex-1 bg-[#ffffff]" />
            <span className="h-8 flex-1 bg-[#f4f4f5]" />
            <span className="h-8 flex-1 bg-[#18181b]" />
            <span className="h-8 flex-1 bg-[#e4e4e7]" />
          </div>
        </button>

        {themes.map((theme) => (
          <div
            key={theme.id}
            className={cn(
              "rounded-lg border p-3 transition-colors hover:bg-accent/60",
              selectedThemeId === theme.id && "border-primary bg-primary/5"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                className="min-w-0 flex-1 text-left"
                disabled={isPending}
              >
                <p className="truncate text-sm font-medium">{theme.name}</p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {selectedThemeId === theme.id && <span className="text-xs text-primary">Aktif</span>}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteTheme(theme.id)}
                  disabled={isPending}
                  title="Hapus tema"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleThemeChange(theme.id)}
              className="flex w-full overflow-hidden rounded-md border"
              disabled={isPending}
            >
              {(parseThemeColors(theme.colors)?.swatches ?? []).map((swatch) => (
                <span key={swatch} className="h-8 flex-1" style={{ backgroundColor: swatch }} />
              ))}
            </button>
          </div>
        ))}
      </div>
      {themes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada tema tersimpan. Unggah foto profil untuk membuat tema dari palet warna foto.
        </p>
      ) : null}
      {message && <p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>}
    </div>
  );
}

export function SettingTab() {
  const router = useRouter();
  const { data: session } = useSession();
  const { currency, setCurrency, loading } = useCurrency();
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<EditableProfileUser | null>(null);
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
          {getProfileImageSrc(visibleProfileUser.image) ? (
            <Image src={getProfileImageSrc(visibleProfileUser.image)!} alt="Foto profil" width={36} height={36} className="size-9 rounded-full object-cover" unoptimized />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {visibleProfileUser.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{visibleProfileUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">{visibleProfileUser.email}</p>
          </div>
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

        <AccordionItem value="currency">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <HugeiconsIcon icon={CurrencyIcon} strokeWidth={2} className="size-4" />
              Mata Uang
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Pilih mata uang untuk tampilan. Semua data tetap disimpan dalam IDR.
              </p>
              <Select value={currency} onValueChange={setCurrency} disabled={loading}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              Berulang
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
