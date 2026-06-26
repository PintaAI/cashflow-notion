"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BookEditIcon,
  CheckmarkCircle01Icon,
  CogIcon,
  Copy01Icon,
  Delete02Icon,
  Share01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import {
  createNoteInvite,
  deleteNote,
  deleteNoteInvite,
  getNoteInvitations,
  updateNoteContent,
  updateNoteIcon,
  updateNoteTitle,
  type NoteInvitationInfo,
  type UserNote,
} from "@/app/actions/notes";
import { NoteIconPicker, type NoteIconValue } from "@/components/ui/icon-picker";
import { SidebarTrigger } from "@/components/layout";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const Editor = dynamic(
  () => import("@/components/notes/block-note-editor").then((mod) => mod.BlockNoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
      </div>
    ),
  }
);

type NoteEditorPageProps = {
  note: UserNote;
};

export function NoteEditorPage({ note }: NoteEditorPageProps) {
  const router = useRouter();
  const [currentNote, setCurrentNote] = useState(note);
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [message, setMessage] = useState("");
  const [invitations, setInvitations] = useState<NoteInvitationInfo[]>([]);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = currentNote.role === "owner";

  useEffect(() => {
    if (currentNote.role !== "owner") return;

    let cancelled = false;
    getNoteInvitations(currentNote.id)
      .then((items) => {
        if (!cancelled) setInvitations(items);
      })
      .catch(() => {
        if (!cancelled) setInvitations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentNote.id, currentNote.role]);

  function handleTitleSave() {
    if (titleDraft.trim() === currentNote.title) return;

    startTransition(async () => {
      try {
        await updateNoteTitle(currentNote.id, titleDraft);
        setCurrentNote((prev) => ({ ...prev, title: titleDraft.trim() }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal menyimpan judul.");
      }
    });
  }

  async function handleIconChange(nextIcon: NoteIconValue) {
    const previousNote = currentNote;
    setCurrentNote((prev) => ({ ...prev, ...nextIcon }));

    try {
      await updateNoteIcon(currentNote.id, nextIcon);
    } catch (error) {
      setCurrentNote(previousNote);
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ikon.");
    }
  }

  function handleDeleteNote() {
    if (!confirm(`Hapus catatan "${currentNote.title}"?`)) return;

    startTransition(async () => {
      await deleteNote(currentNote.id);
      router.push("/notes");
    });
  }

  function handleCreateInvite() {
    startTransition(async () => {
      const code = await createNoteInvite(currentNote.id);
      setInvitations(await getNoteInvitations(currentNote.id));
      const link = `${window.location.origin}/notes?code=${code}`;
      await navigator.clipboard.writeText(link);
      setMessage("Link undangan dibuat dan disalin.");
    });
  }

  function handleDeleteInvite(invitationId: string) {
    startTransition(async () => {
      await deleteNoteInvite(currentNote.id, invitationId);
      setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
    });
  }

  async function handleCopyInvite(invitation: NoteInvitationInfo) {
    const link = `${window.location.origin}/notes?code=${invitation.code}`;
    await navigator.clipboard.writeText(link);
    setCopiedInviteId(invitation.id);
    setTimeout(() => setCopiedInviteId(null), 1400);
  }

  function getInviteDisplay(invitation: NoteInvitationInfo) {
    return `.../notes?code=${invitation.code}`;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <HugeiconsIcon icon={BookEditIcon} strokeWidth={2} className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Notes</h1>
        </div>
        <Link href="/notes" className="text-xs text-muted-foreground hover:text-foreground">
          Kembali
        </Link>
      </div>

    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">

      {message && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{message}</p>}

      <div className="mb-2 space-y-3 sm:mb-4">
        <div className="py-2 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
              Note Editor
            </span>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
              <HugeiconsIcon icon={currentNote.role === "owner" ? CheckmarkCircle01Icon : Share01Icon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">{currentNote.role === "owner" ? "pemilik" : "shared"}</span>
              <span className="mx-0.5 text-muted-foreground/40">|</span>
              <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">{currentNote.memberCount}</span>
              <span className="hidden sm:inline">anggota</span>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="xs" className="h-6 gap-1 rounded-full px-2 text-[11px]">
                    <HugeiconsIcon icon={CogIcon} strokeWidth={2} className="size-3" />
                    Setting
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Setting Catatan</DialogTitle>
                    <DialogDescription>
                      Kelola anggota dan link invite untuk catatan ini.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                          <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-4" />
                          Anggota
                        </h2>
                        <span className="text-xs text-muted-foreground">{currentNote.memberCount} anggota</span>
                      </div>
                      <div className="space-y-1.5">
                        {currentNote.members.map((member) => (
                          <div key={member.id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                            <UserAvatar user={member.user} size={26} className="size-6.5" fallbackClassName="text-[10px]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{member.user.name ?? member.user.email}</p>
                              <p className="text-[10px] text-muted-foreground">{member.role === "owner" ? "Pemilik" : "Editor"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
                          <HugeiconsIcon icon={Share01Icon} strokeWidth={2} className="size-4" />
                          Link Invite
                        </h2>
                        {isOwner && (
                          <Button size="sm" onClick={handleCreateInvite} disabled={isPending}>
                            <HugeiconsIcon icon={Share01Icon} strokeWidth={2} className="size-3.5" />
                            Buat
                          </Button>
                        )}
                      </div>
                      {!isOwner ? (
                        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Hanya pemilik yang bisa membuat link undangan.</p>
                      ) : invitations.length === 0 ? (
                        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Belum ada undangan aktif.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {invitations.map((invitation) => {
                            const expired = new Date(invitation.expiresAt) < new Date();
                            return (
                              <div key={invitation.id} className="space-y-2 rounded-md border bg-muted/30 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn(
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                    invitation.status === "pending" && !expired ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                  )}>
                                    {expired ? "Kadaluarsa" : invitation.status === "pending" ? "Aktif" : "Digunakan"}
                                  </span>
                                  <Button variant="outline" size="xs" onClick={() => handleDeleteInvite(invitation.id)}>
                                    Hapus
                                  </Button>
                                </div>
                                <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted p-2">
                                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                    {getInviteDisplay(invitation)}
                                  </p>
                                  <Button variant="outline" size="xs" onClick={() => handleCopyInvite(invitation)}>
                                    <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3" />
                                    {copiedInviteId === invitation.id ? "Tersalin" : "Copy"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {isOwner && (
                      <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                        <div className="space-y-1">
                          <h2 className="text-sm font-semibold text-destructive">Hapus Catatan</h2>
                          <p className="text-xs text-muted-foreground">Catatan akan dihapus permanen untuk semua anggota.</p>
                        </div>
                        <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteNote} disabled={isPending}>
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                          Hapus catatan
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <NoteIconPicker
                  icon={currentNote.icon}
                  iconType={currentNote.iconType}
                  iconColor={currentNote.iconColor}
                  onValueChange={handleIconChange}
                  triggerClassName="size-8 rounded-lg"
                />
                <Input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 text-2xl font-bold leading-tight tracking-tight shadow-none transition-all focus-visible:ring-0 sm:text-3xl md:text-4xl"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/70 sm:gap-2 sm:text-xs">
              <span>Update {new Date(currentNote.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <Editor
          key={currentNote.id}
          initialContent={currentNote.contentJson ?? undefined}
          debounceMs={900}
          onSave={async (content) => {
            await updateNoteContent(currentNote.id, content);
            setCurrentNote((prev) => ({
              ...prev,
              contentJson: content.contentJson,
              contentHtml: content.html,
              contentMarkdown: content.markdown,
              updatedAt: new Date().toISOString(),
            }));
          }}
          className="min-h-[58dvh] sm:min-h-[520px]"
        />
      </section>

    </div>
    </>
  );
}
