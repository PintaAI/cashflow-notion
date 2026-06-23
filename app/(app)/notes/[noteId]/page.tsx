import { notFound } from "next/navigation";
import { getUserNote } from "@/app/actions/notes";
import { NoteEditorPage } from "@/components/notes";

export default async function Page({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const note = await getUserNote(noteId);

  if (!note) notFound();

  return <NoteEditorPage key={note.id} note={note} />;
}
