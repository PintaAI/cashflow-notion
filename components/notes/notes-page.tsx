"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  BookEditIcon,
  Share01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import {
  acceptNoteInvite,
  createNote,
  getUserNotes,
  type UserNote,
} from "@/app/actions/notes";
import { NoteShareDialog } from "@/components/notes/note-share-dialog";
import { SidebarTrigger } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NotesPageProps = {
  initialNotes: UserNote[];
  inviteCode?: string;
};

export function NotesPage({ initialNotes, inviteCode }: NotesPageProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [newTitle, setNewTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const sharedCount = notes.filter((note) => note.memberCount > 1).length;
  const privateCount = notes.length - sharedCount;

  const refreshNotes = useCallback(async () => {
    setNotes(await getUserNotes());
  }, []);

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

  function handleCreateNote() {
    startTransition(async () => {
      const result = await createNote(newTitle);
      setNewTitle("");
      await refreshNotes();
      router.push(`/notes/${result.noteId}`);
    });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between sm:mb-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <HugeiconsIcon icon={BookEditIcon} strokeWidth={2} className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Notes</h1>
        </div>
      </div>

    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <div className="mb-2 space-y-3 sm:mb-4">
        <div className="py-2 sm:py-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-end gap-1.5">
                <div className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl">
                  {notes.length}
                </div>
                <span className="pb-1 text-xs text-muted-foreground/70">total</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
                <HugeiconsIcon icon={BookEditIcon} size={14} className="text-muted-foreground" />
                <span className="font-medium text-muted-foreground/70">{privateCount}</span>
                <span className="hidden sm:inline">pribadi</span>
                <span className="mx-0.5 text-muted-foreground/40">|</span>
                <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
                <span className="font-medium text-muted-foreground/70">{sharedCount}</span>
                <span className="hidden sm:inline">shared</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Catatan pribadi dan bersama yang bisa diedit real-time style.
            </p>
          </div>
        </div>
      </div>

      {message && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{message}</p>}

      <section>
        <div className="flex gap-2 rounded-md border bg-muted/30 p-1.5 sm:p-2">
          <Input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreateNote();
            }}
            placeholder="Judul catatan baru"
            disabled={isPending}
            className="h-9 min-w-0 flex-1 rounded-md border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
          />
          <Button size="icon-sm" onClick={handleCreateNote} disabled={isPending} aria-label="Buat catatan">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2.4} className="size-4" />
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Daftar catatan</p>
          <p className="text-xs text-muted-foreground">Seluruh catatan pribadi dan shared</p>
        </div>

        <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada catatan. Buat catatan baru untuk mulai menulis.
          </p>
        ) : notes.map((note) => {
          const shared = note.memberCount > 1;
          const sharedWithUser = note.role !== "owner";

          return (
            <div
              key={note.id}
              className="flex items-center gap-2.5 rounded-md border bg-muted/30 p-2 transition-colors hover:bg-muted/60 sm:gap-3"
            >
              <Link href={`/notes/${note.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
                <div className="inline-flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={sharedWithUser ? Share01Icon : BookEditIcon}
                    strokeWidth={2.1}
                    className={cn("size-4 shrink-0", sharedWithUser ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="truncate text-sm font-medium">{note.title}</span>
                  {shared ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} className="size-3" />
                      {sharedWithUser ? "Dibagikan ke saya" : `${note.memberCount} anggota`}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-muted-foreground">Pribadi</span>
                  )}
                </div>
                <p className="line-clamp-1 sm:line-clamp-2 text-xs text-muted-foreground">
                  {note.contentMarkdown?.trim() || "Mulai tulis catatan..."}
                </p>
              </Link>
              <NoteShareDialog
                noteId={note.id}
                role={note.role}
                memberCount={note.memberCount}
                members={note.members}
              />
            </div>
          );
        })}
        </div>
      </section>
    </div>
    </>
  );
}
