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
    <div className="mx-auto max-w-2xl space-y-4">
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
          <p className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            Belum ada catatan. Buat catatan baru untuk mulai menulis.
          </p>
        ) : notes.map((note) => {
          const shared = note.memberCount > 1;
          const sharedWithUser = note.role !== "owner";

          return (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/60"
            >
              <HugeiconsIcon
                icon={sharedWithUser ? Share01Icon : BookEditIcon}
                strokeWidth={2.1}
                className={cn("mt-0.5 size-5 shrink-0", sharedWithUser ? "text-primary" : "text-muted-foreground")}
              />
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
