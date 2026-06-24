"use client";

import { useEffect, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Copy01Icon,
  Delete02Icon,
  Share01Icon,
} from "@hugeicons/core-free-icons";

import {
  createNoteInvite,
  deleteNoteInvite,
  getNoteInvitations,
  type NoteInvitationInfo,
} from "@/app/actions/notes";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type NoteShareDialogProps = {
  noteId: string;
  role: string;
  memberCount: number;
  members: {
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string; image: string | null };
  }[];
};

export function NoteShareDialog({ noteId, role, members }: NoteShareDialogProps) {
  const [invitations, setInvitations] = useState<NoteInvitationInfo[]>([]);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = role === "owner";
  const invitation = invitations[0];
  const invitationExpired = invitation ? new Date(invitation.expiresAt) < new Date() : false;

  useEffect(() => {
    if (!isOwner) return;

    let cancelled = false;
    getNoteInvitations(noteId)
      .then((items) => {
        if (!cancelled) setInvitations(items);
      })
      .catch(() => {
        if (!cancelled) setInvitations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [noteId, isOwner]);

  function handleCreateInvite() {
    startTransition(async () => {
      const code = await createNoteInvite(noteId);
      const refreshedInvitations = await getNoteInvitations(noteId);
      setInvitations(refreshedInvitations);
      const link = `${window.location.origin}/notes?code=${code}`;
      await navigator.clipboard.writeText(link);
      const createdInvitation = refreshedInvitations.find((invitation) => invitation.code === code);
      if (createdInvitation) {
        setCopiedInviteId(createdInvitation.id);
        setTimeout(() => setCopiedInviteId(null), 1400);
      }
    });
  }

  function handleDeleteInvite(invitationId: string) {
    startTransition(async () => {
      await deleteNoteInvite(noteId, invitationId);
      setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
    });
  }

  async function handleCopyInvite(invitation: NoteInvitationInfo) {
    const link = `${window.location.origin}/notes?code=${invitation.code}`;
    await navigator.clipboard.writeText(link);
    setCopiedInviteId(invitation.id);
    setTimeout(() => setCopiedInviteId(null), 1400);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="xs"
          className="h-6 gap-1 rounded-full px-2 text-[11px]"
        >
          <HugeiconsIcon icon={Share01Icon} strokeWidth={2} className="size-3" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bagikan catatan</DialogTitle>
          <DialogDescription>
            Bagikan note dan ajak kolaborasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!isOwner ? (
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <HugeiconsIcon icon={Share01Icon} strokeWidth={2} className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Hanya pemilik yang bisa membuat link</p>
              <p className="mt-1 text-xs text-muted-foreground">Minta pemilik catatan untuk membuat undangan baru.</p>
            </div>
          ) : !invitation ? (
            <div className="rounded-xl border bg-primary/15 bg-primary/5 p-4 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HugeiconsIcon icon={Share01Icon} strokeWidth={2} className="size-5" />
              </div>
              <p className="text-sm font-medium">Belum ada link undangan</p>
              <p className="mt-1 text-xs text-muted-foreground">Buat satu link, lalu linknya otomatis disalin.</p>
              <Button className="mt-4 w-full" onClick={handleCreateInvite} disabled={isPending}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
                {isPending ? "Membuat..." : "Buat link undangan"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Button className="h-11 w-full gap-2" onClick={() => handleCopyInvite(invitation)} disabled={invitationExpired}>
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-4" />
                {copiedInviteId === invitation.id ? "Link tersalin" : "Salin link undangan"}
              </Button>
              <Button variant="ghost" size="xs" className="w-full text-muted-foreground" onClick={() => handleDeleteInvite(invitation.id)}>
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3" />
                Hapus link
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Whos here</p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <div key={member.id} className="flex min-w-0 items-center gap-2 rounded-full bg-muted/50 px-2 py-1">
                  <UserAvatar
                    user={member.user}
                    size={24}
                    className="size-6"
                    fallbackClassName="text-[10px]"
                  />
                  <span className="max-w-28 truncate text-xs font-medium">{member.user.name ?? member.user.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
