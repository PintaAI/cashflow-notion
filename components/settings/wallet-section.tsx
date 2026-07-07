"use client";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Edit02Icon, RefreshIcon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { getPalette } from "colorthief";
import { useSession } from "@/lib/auth-client";
import { ImageCropDialog } from "@/components/profile";
import { UserAvatar } from "@/components/profile";
import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useManagement } from "@/components/providers/management-provider";
import { cn } from "@/lib/utils"
import { getManagementImageSrc } from "@/lib/management-image";
import { generateThemeFromSwatches, type GeneratedThemeColors } from "@/lib/theme-palettes";
import { LOCAL_THEME_CHANGED_EVENT, LOCAL_THEMES_KEY, SELECTED_LOCAL_THEME_KEY, type LocalTheme } from "@/components/layout";
import {
  getCurrentManagement,
  createInvite,
  deleteInvite,
  getManagementInvitations,
  getUserManagements,
  removeManagementMember,
  switchManagement,
  renameManagement,
  updateManagementImage,
  createManagement,
  type ManagementInvitation,
  type ManagementWithMembers,
  type ManagementImageActionState,
} from "@/app/actions/management";

const initialImageState: ManagementImageActionState = { status: "idle", message: "" };
const WALLET_CACHE_KEY = "cashflow_wallets";
const CURRENT_MANAGEMENT_CACHE_PREFIX = "cashflow_current_management:";
const INVITATION_CACHE_PREFIX = "cashflow_invitations:";

type UserManagements = Awaited<ReturnType<typeof getUserManagements>>;

function readWalletCache(managementId: string): UserManagements {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WALLET_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.image ?? null,
      imageTheme: item.imageTheme ?? null,
      role: item.role ?? "member",
      memberCount: item.memberCount ?? 0,
      createdAt: item.createdAt ?? new Date().toISOString(),
      updatedAt: item.updatedAt ?? new Date().toISOString(),
      isActive: item.id === managementId,
    })) as UserManagements;
  } catch {
    return [];
  }
}

function writeWalletCache(data: UserManagements) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WALLET_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage failures; the server remains the source of truth.
  }
}

function readCurrentManagementCache(managementId: string): ManagementWithMembers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CURRENT_MANAGEMENT_CACHE_PREFIX}${managementId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCurrentManagementCache(managementId: string, data: ManagementWithMembers) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CURRENT_MANAGEMENT_CACHE_PREFIX}${managementId}`, JSON.stringify(data));
  } catch {
    // Ignore storage failures; wallet details can still be loaded from the server.
  }
}

function readInvitationCache(managementId: string): ManagementInvitation[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${INVITATION_CACHE_PREFIX}${managementId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeInvitationCache(managementId: string, data: ManagementInvitation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${INVITATION_CACHE_PREFIX}${managementId}`, JSON.stringify(data));
  } catch {
    // Ignore storage failures; invitations can still be loaded from the server.
  }
}

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

function saveActiveManagementTheme(managementId: string, name: string, theme: GeneratedThemeColors) {
  const localTheme: LocalTheme = {
    id: `management:${managementId}`,
    name: `${name} theme`,
    colors: theme,
    createdAt: new Date().toISOString(),
  };
  const nextThemes = [localTheme, ...getLocalThemes().filter((item) => item.id !== localTheme.id)].slice(0, 12);
  window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
  window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, localTheme.id);
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
}

function ManagementSettings() {
  const { data: session } = useSession();
  const router = useRouter();
  const { managementId } = useManagement();
  const [management, setManagement] = useState<ManagementWithMembers | null>(() => readCurrentManagementCache(managementId));
  const [managements, setManagements] = useState<UserManagements>(() => readWalletCache(managementId));
  const initialInvitations = readInvitationCache(managementId);
  const [invitations, setInvitations] = useState<ManagementInvitation[]>(initialInvitations ?? []);
  const [invitationsLoaded, setInvitationsLoaded] = useState(initialInvitations !== null);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [imageState, setImageState] = useState<ManagementImageActionState>(initialImageState);
  const [imagePending, setImagePending] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
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

  useEffect(() => {
    let cancelled = false;

    const cachedManagement = readCurrentManagementCache(managementId);
    if (cachedManagement) {
      queueMicrotask(() => {
        if (cancelled) return;
        setManagement(cachedManagement);
        setNameValue(cachedManagement.management.name);
      });
    }
    const cachedManagements = readWalletCache(managementId);
    if (cachedManagements.length > 0) {
      queueMicrotask(() => {
        if (!cancelled) setManagements(cachedManagements);
      });
    }
    const cachedInvitations = readInvitationCache(managementId);
    queueMicrotask(() => {
      if (cancelled) return;
      setInvitations(cachedInvitations ?? []);
      setInvitationsLoaded(cachedInvitations !== null);
      setInvitationsOpen(false);
    });

    getCurrentManagement(managementId).then((m) => {
      if (cancelled || !m) return;
      setManagement(m);
      setNameValue(m.management.name);
      writeCurrentManagementCache(managementId, m);
    });
    getUserManagements(managementId).then((items) => {
      if (cancelled) return;
      setManagements(items);
      writeWalletCache(items);
    });

    return () => {
      cancelled = true;
    };
  }, [managementId]);

  async function handleSwitch(id: string) {
    try {
      setEditingName(false);
      setManagements((prev) => {
        const next = prev.map((m) => ({ ...m, isActive: m.id === id }));
        writeWalletCache(next);
        return next;
      });
      router.push(`/dompet/${id}?tab=setting&section=management`);
      void switchManagement(id).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadInvitations() {
    setLoadingInvitations(true);
    try {
      const items = await getManagementInvitations(managementId);
      setInvitations(items);
      setInvitationsLoaded(true);
      writeInvitationCache(managementId, items);
    } catch (err) {
      console.error(err);
      setInvitationsLoaded(true);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  }

  function handleToggleInvitations() {
    const nextOpen = !invitationsOpen;
    setInvitationsOpen(nextOpen);
    if (nextOpen && !invitationsLoaded) {
      void loadInvitations();
    }
  }

  async function handleGenerateInvite() {
    setCreatingInvite(true);
    try {
      await createInvite(managementId);
      const items = await getManagementInvitations(managementId);
      setInvitations(items);
      setInvitationsLoaded(true);
      setInvitationsOpen(true);
      writeInvitationCache(managementId, items);
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleDeleteInvite(invitationId: string) {
    setDeletingInviteId(invitationId);
    try {
      await deleteInvite(invitationId, managementId);
      setInvitations((prev) => {
        const next = prev.filter((invitation) => invitation.id !== invitationId);
        writeInvitationCache(managementId, next);
        return next;
      });
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
      await removeManagementMember(memberId, managementId);
      const nextManagement = management
        ? {
            ...management,
            management: {
              ...management.management,
              members: management.management.members.filter((member) => member.id !== memberId),
            },
          }
        : null;
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
      if (nextManagement) writeCurrentManagementCache(managementId, nextManagement);
      const userManagements = await getUserManagements(managementId);
      setManagements(userManagements);
      writeWalletCache(userManagements);
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
      await renameManagement(trimmed, managementId);
      if (management) {
        writeCurrentManagementCache(managementId, {
          ...management,
          management: { ...management.management, name: trimmed },
        });
      }
      setManagement((prev) =>
        prev ? { ...prev, management: { ...prev.management, name: trimmed } } : prev
      );
      setManagements((prev) => {
        const next = prev.map((m) => (m.isActive ? { ...m, name: trimmed } : m));
        writeWalletCache(next);
        return next;
      });
    } catch (err) {
      setNameValue(management?.management.name ?? "");
      console.error(err);
    } finally {
      setNameSaving(false);
      setEditingName(false);
    }
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    setCropFile(file);
  }

  async function handleCropSave(croppedFile: File) {
    if (!management) return;

    const previewUrl = URL.createObjectURL(croppedFile);
    setImagePreviewUrl(previewUrl);
    setImagePending(true);
    setImageState({ status: "idle", message: "Mengekstrak warna..." });

    let theme: GeneratedThemeColors | null = null;
    try {
      themeExtractionRef.current = extractThemeFromImageUrl(previewUrl);
      theme = await themeExtractionRef.current;
    } catch {
      theme = null;
    }

    const formData = new FormData();
    formData.set("managementId", managementId);
    formData.set("image", croppedFile);
    if (theme) formData.set("theme", JSON.stringify(theme));

    try {
      const result = await updateManagementImage(initialImageState, formData);
      setImageState(result);
      if (result.status === "success" && result.management) {
        const imageTheme = result.management.imageTheme ?? theme;
        if (management) {
          writeCurrentManagementCache(managementId, {
            ...management,
            management: {
              ...management.management,
              image: result.management.image ?? management.management.image,
              imageTheme,
            },
          });
        }
        setManagement((prev) => prev
          ? {
              ...prev,
              management: {
                ...prev.management,
                image: result.management?.image ?? prev.management.image,
                imageTheme,
              },
            }
          : prev
        );
        setManagements((prev) => {
          const next = prev.map((item) => item.id === managementId ? {
            ...item,
            image: result.management?.image ?? item.image,
            imageTheme,
          } : item);
          writeWalletCache(next);
          return next;
        });
        if (imageTheme) saveActiveManagementTheme(managementId, management.management.name, imageTheme);
        router.refresh();
      }
    } finally {
      setImagePending(false);
      setImagePreviewUrl(null);
      URL.revokeObjectURL(previewUrl);
    }
  }

  async function handleCreate() {
    const trimmed = createName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const result = await createManagement(trimmed);
      setCreateOpen(false);
      setCreateName("");
      writeWalletCache([
        ...managements.map((item) => ({ ...item, isActive: false })),
        {
          id: result.managementId,
          name: result.name,
          image: null,
          imageTheme: null,
          role: "owner",
          memberCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
        },
      ] as UserManagements);
      router.push(`/dompet/${result.managementId}?tab=setting&section=management`);
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
      {managements.length > 0 && (
        <div className="space-y-1.5">
          {managements.map((m) => {
            const imageSrc = m.isActive && imagePreviewUrl ? imagePreviewUrl : getManagementImageSrc(m.image);
            const canEditImage = m.isActive && isOwner;

            return (
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
                {canEditImage ? (
                  <label
                    className="group relative shrink-0 cursor-pointer"
                    aria-label="Ganti foto dompet"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Avatar className="size-8 text-xs font-semibold">
                      {imageSrc ? <AvatarImage src={imageSrc} alt="Foto dompet" /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4" />
                      </AvatarFallback>
                      <AvatarBadge className="right-0 bottom-0 size-3.5 border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
                        {imagePending ? (
                          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-2 animate-spin" />
                        ) : (
                          <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-2" />
                        )}
                      </AvatarBadge>
                    </Avatar>
                    <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" disabled={imagePending} />
                  </label>
                ) : (
                  <Avatar className="size-8 text-xs font-semibold">
                    {imageSrc ? <AvatarImage src={imageSrc} alt="Foto dompet" /> : null}
                    <AvatarFallback className={cn("bg-muted text-muted-foreground", m.isActive && "bg-primary/10 text-primary")}>
                      <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
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
                    {canEditImage ? " · klik ikon untuk foto/tema" : ""}
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
                    title="Edit nama dompet"
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3" />
                  </button>
                )}
                {m.isActive && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">Aktif</span>
                )}
              </div>
            );
          })}
          {imageState.message && <p className="px-1 text-xs text-muted-foreground" aria-live="polite">{imageState.message}</p>}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCreateOpen(!createOpen)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary bg-primary/5 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/10"
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

      <ImageCropDialog
        open={cropFile !== null}
        file={cropFile}
        onClose={() => setCropFile(null)}
        onSave={handleCropSave}
      />

      <div className="space-y-1">
        <p className="text-sm font-medium">Anggota dari {management.management.name}</p>
        <div className="space-y-1.5">
          {management.management.members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 border border-border rounded p-2">
              <UserAvatar user={member.user} size={24} className="size-6" fallbackClassName="text-[10px]" />
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
          ))}
        </div>
      </div>

      {isOwner && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGenerateInvite}
            disabled={creatingInvite || loadingInvitations}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-primary bg-primary/5 px-3 py-2 text-xs text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingInvite ? "Membuat..." : `+ Buat undangan untuk ${management.management.name}`}
          </button>

          <button
            type="button"
            onClick={handleToggleInvitations}
            disabled={loadingInvitations}
            className="flex w-full items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-sm font-medium">Link Invite</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {loadingInvitations ? "Memuat..." : invitationsOpen ? "Sembunyikan" : "Lihat"}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                className={cn("size-3.5 transition-transform", invitationsOpen && "rotate-180")}
              />
            </span>
          </button>

          {invitationsOpen && !invitationsLoaded ? (
            <p className="text-xs text-muted-foreground">Memuat daftar undangan...</p>
          ) : invitationsOpen && invitations.length > 0 ? (
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
          ) : invitationsOpen ? (
            <p className="text-xs text-muted-foreground">Belum ada undangan.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export { ManagementSettings }
