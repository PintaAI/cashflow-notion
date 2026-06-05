"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react"
import { Edit02Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useSession } from "@/lib/auth-client";
import { UserAvatar } from "@/components/profile";
import { Button } from "@/components/ui/button";
import { useManagement } from "@/components/providers/management-provider";
import { cn } from "@/lib/utils"
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

function ManagementSettings() {
  const { data: session } = useSession();
  const router = useRouter();
  const { managementId } = useManagement();
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
    getCurrentManagement(managementId).then((m) => {
      if (m) {
        setManagement(m);
        setNameValue(m.management.name);
      }
    });
    getUserManagements(managementId).then(setManagements);
    getManagementInvitations(managementId)
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }

  useEffect(() => { load(); }, [managementId]);

  async function handleSwitch(id: string) {
    try {
      setEditingName(false);
      setManagements((prev) => prev.map((m) => ({ ...m, isActive: m.id === id })));
      router.push(`/dompet/${id}`);
      router.refresh();
      void switchManagement(id).catch(console.error);

      void Promise.all([
        getCurrentManagement(id),
        getUserManagements(id),
        getManagementInvitations(id).catch(() => []),
      ]).then(([currentManagement, userManagements, currentInvitations]) => {
        if (currentManagement) {
          setManagement(currentManagement);
          setNameValue(currentManagement.management.name);
        }
        setManagements(userManagements);
        setInvitations(currentInvitations);
      }).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerateInvite() {
    setCreatingInvite(true);
    try {
      await createInvite(managementId);
      setInvitations(await getManagementInvitations(managementId));
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
      await removeManagementMember(memberId, managementId);
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
      setManagements(await getUserManagements(managementId));
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
      setManagement((prev) =>
        prev ? { ...prev, management: { ...prev.management, name: trimmed } } : prev
      );
      setManagements((prev) =>
        prev.map((m) => (m.isActive ? { ...m, name: trimmed } : m))
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
      const result = await createManagement(trimmed);
      setCreateOpen(false);
      setCreateName("");
      router.push(`/dompet/${result.managementId}`);
      router.refresh();
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

export { ManagementSettings }
