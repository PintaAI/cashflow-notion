import { NotesPage } from "@/components/notes";
import { getUserNotes } from "@/app/actions/notes";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const [{ code }, notes] = await Promise.all([searchParams, getUserNotes()]);

  return <NotesPage initialNotes={notes} inviteCode={code} />;
}
