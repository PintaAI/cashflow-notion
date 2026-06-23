"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  BookEditIcon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Delete02Icon,
  Share01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import {
  acceptNoteInvite,
  createNote,
  createNoteInvite,
  deleteNote,
  deleteNoteInvite,
  getNoteInvitations,
  getUserNotes,
  updateNoteContent,
  updateNoteTitle,
  type NoteInvitationInfo,
  type UserNote,
} from "@/app/actions/notes";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const Editor = dynamic(
  () => import("@/components/notes/block-note-editor").then((mod) => mod.BlockNoteEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[420px] rounded-xl border bg-card p-4 text-sm text-muted-foreground">Memuat editor...</div>,
  }
);

type NotesPageProps = {
  initialNotes: UserNote[];
  inviteCode?: string;
};

export function NotesPage({ initialNotes, inviteCode }: NotesPageProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState(initialNotes[0]?.id ?? null);
  const [newTitle, setNewTitle] = useState("");
  const [titleDraft, setTitleDraft] = useState(initialNotes[0]?.title ?? "");
  const [message, setMessage] = useState("");
  const [invitations, setInvitations] = useState<NoteInvitationInfo[]>([]);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null;
  const isOwner = selectedNote?.role === "owner";

  const refreshNotes = useCallback(async (selectId?: string) => {
    const nextNotes = await getUserNotes();
    setNotes(nextNotes);
    if (selectId) {
      setSelectedNoteId(selectId);
      setTitleDraft(nextNotes.find((note) => note.id === selectId)?.title ?? "");
    } else if (!nextNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(nextNotes[0]?.id ?? null);
      setTitleDraft(nextNotes[0]?.title ?? "");
    }
  }, [selectedNoteId]);

  function handleSelectNote(note: UserNote) {
    setSelectedNoteId(note.id);
    setTitleDraft(note.title);
    setInvitations([]);
  }

  useEffect(() => {
    if (!inviteCode) return;
    const code = inviteCode;
    let cancelled = false;

    async function acceptInvite() {
      const result = await acceptNoteInvite(code);
      if (cancelled) return;

      if (result.success) {
        setMessage("Berhasil bergabung ke catatan bersama.");
        await refreshNotes();
      } else {
        setMessage(result.message);
      }

      router.replace("/notes");
    }

    void acceptInvite();
    return () => {
      cancelled = true;
    };
  }, [inviteCode, refreshNotes, router]);

  useEffect(() => {
    if (!selectedNoteId || selectedNote?.role !== "owner") return;

    let cancelled = false;
    getNoteInvitations(selectedNoteId)
      .then((items) => {
        if (!cancelled) setInvitations(items);
      })
      .catch(() => {
        if (!cancelled) setInvitations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNoteId, selectedNote?.role]);

  function handleCreateNote() {
    startTransition(async () => {
      const result = await createNote(newTitle);
      setNewTitle("");
      await refreshNotes(result.noteId);
    });
  }

  function handleTitleSave() {
    if (!selectedNote || titleDraft.trim() === selectedNote.title) return;

    startTransition(async () => {
      try {
        await updateNoteTitle(selectedNote.id, titleDraft);
        setNotes((current) => current.map((note) => note.id === selectedNote.id ? { ...note, title: titleDraft.trim() } : note));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Gagal menyimpan judul.");
      }
    });
  }

  function handleDeleteNote() {
    if (!selectedNote || !confirm(`Hapus catatan "${selectedNote.title}"?`)) return;

    startTransition(async () => {
      await deleteNote(selectedNote.id);
      await refreshNotes();
    });
  }

  function handleCreateInvite() {
    if (!selectedNote) return;

    startTransition(async () => {
      const code = await createNoteInvite(selectedNote.id);
      setInvitations(await getNoteInvitations(selectedNote.id));
      const link = `${window.location.origin}/notes?code=${code}`;
      await navigator.clipboard.writeText(link);
      setMessage("Link undangan dibuat dan disalin.");
    });
  }

  function handleDeleteInvite(invitationId: string) {
    if (!selectedNote) return;

    startTransition(async () => {
      await deleteNoteInvite(selectedNote.id, invitationId);
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
    <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-semibold">Notes</h1>
            <p className="text-xs text-muted-foreground">Catatan pribadi dan bersama.</p>
          </div>
          <HugeiconsIcon icon={BookEditIcon} strokeWidth={2.2} className="size-5 text-primary" />
        </div>

        {message && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{message}</p>}

        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreateNote();
            }}
            placeholder="Judul catatan baru"
            disabled={isPending}
          />
          <Button size="icon" onClick={handleCreateNote} disabled={isPending} aria-label="Buat catatan">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2.4} className="size-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          {notes.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Belum ada catatan.</p>
          ) : notes.map((note) => {
            const active = note.id === selectedNote?.id;
            const shared = note.memberCount > 1;
            const sharedWithUser = note.role !== "owner";

            return (
              <button
                key={note.id}
                type="button"
                onClick={() => handleSelectNote(note)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/60",
                  active ? "border-primary/40 bg-primary/5" : "border-border bg-background"
                )}
              >
                <div className="flex items-start gap-2">
                  <HugeiconsIcon icon={sharedWithUser ? Share01Icon : BookEditIcon} strokeWidth={2.1} className={cn("mt-0.5 size-4 shrink-0", sharedWithUser ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{note.title}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {note.contentMarkdown?.trim() || "Mulai tulis catatan..."}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {shared ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                          <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
                          {sharedWithUser ? "Dibagikan ke saya" : `${note.memberCount} anggota`}
                        </span>
                      ) : (
                        <span>Pribadi</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="min-w-0 space-y-4">
        {!selectedNote ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed bg-card text-sm text-muted-foreground">
            Buat catatan untuk mulai menulis.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                      <HugeiconsIcon icon={selectedNote.role === "owner" ? CheckmarkCircle01Icon : Share01Icon} strokeWidth={2} className="size-3.5" />
                      {selectedNote.role === "owner" ? "Pemilik" : "Shared note"}
                    </span>
                    <span>{selectedNote.memberCount} anggota</span>
                    <span>Update {new Date(selectedNote.updatedAt).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
                {isOwner && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteNote} disabled={isPending}>
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                    Hapus
                  </Button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-2 shadow-sm sm:p-4">
              <Editor
                key={selectedNote.id}
                initialContent={selectedNote.contentJson ?? undefined}
                debounceMs={900}
                onSave={async (content) => {
                  await updateNoteContent(selectedNote.id, content);
                  setNotes((current) => current.map((note) => note.id === selectedNote.id ? {
                    ...note,
                    contentJson: content.contentJson,
                    contentHtml: content.html,
                    contentMarkdown: content.markdown,
                    updatedAt: new Date().toISOString(),
                  } : note));
                }}
                className="min-h-[520px]"
              />
            </section>

            <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Anggota</h2>
                  {isOwner && (
                    <Button size="sm" onClick={handleCreateInvite} disabled={isPending}>
                      <HugeiconsIcon icon={Share01Icon} strokeWidth={2} className="size-3.5" />
                      Share
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {selectedNote.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <UserAvatar user={member.user} size={26} className="size-6.5" fallbackClassName="text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{member.user.name ?? member.user.email}</p>
                        <p className="text-[10px] text-muted-foreground">{member.role === "owner" ? "Pemilik" : "Editor"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Link Invite</h2>
                {!isOwner ? (
                  <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Hanya pemilik yang bisa membuat link undangan.</p>
                ) : invitations.length === 0 ? (
                  <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Belum ada undangan aktif.</p>
                ) : (
                  <div className="space-y-1.5">
                    {invitations.map((invitation) => {
                      const expired = new Date(invitation.expiresAt) < new Date();
                      return (
                        <div key={invitation.id} className="space-y-2 rounded-lg border p-2">
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
                          <div className="flex min-w-0 items-center gap-2 rounded bg-muted p-2">
                            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                              {`${typeof window === "undefined" ? "" : window.location.origin}/notes?code=${invitation.code}`}
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
            </section>
          </>
        )}
      </main>
    </div>
  );
}
