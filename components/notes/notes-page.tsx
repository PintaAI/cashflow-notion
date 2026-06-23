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
  const sharedCount = notes.filter((note) => note.memberCount > 1).length;

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
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <div className="mb-2 space-y-3 sm:mb-4">
        <div className="py-2 sm:py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
              Notes
            </span>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
              <HugeiconsIcon icon={BookEditIcon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">{notes.length}</span>
              <span className="hidden sm:inline">catatan</span>
              <span className="mx-0.5 text-muted-foreground/40">|</span>
              <HugeiconsIcon icon={UserGroupIcon} size={14} className="text-muted-foreground" />
              <span className="font-medium text-muted-foreground/70">{sharedCount}</span>
              <span className="hidden sm:inline">shared</span>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl font-bold tracking-tight transition-all sm:text-3xl md:text-4xl">
                {notes.length}
              </div>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Catatan pribadi dan bersama yang bisa diedit real-time style.
              </p>
            </div>
            <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={handleCreateNote} disabled={isPending}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
              Baru
            </Button>
          </div>
        </div>
      </div>

      {message && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{message}</p>}

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Buat catatan</p>
          <p className="text-xs text-muted-foreground">Judul bisa diganti lagi setelah masuk ke halaman note.</p>
        </div>
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
          <p className="text-xs text-muted-foreground">Pilih catatan untuk membuka route khususnya.</p>
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
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="flex items-start gap-2.5 rounded-md border bg-muted/30 p-2 transition-colors hover:bg-muted/60 sm:gap-3"
            >
              <HugeiconsIcon
                icon={sharedWithUser ? Share01Icon : BookEditIcon}
                strokeWidth={2.1}
                className={cn("mt-1 size-4 shrink-0", sharedWithUser ? "text-primary" : "text-muted-foreground")}
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
      </section>
    </div>
  );
}
