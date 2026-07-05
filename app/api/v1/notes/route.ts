import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { getUserNotes, createNote } from "@/app/actions/notes";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await getUserNotes();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title : "";
    const data = await createNote(title);
    return ok({ noteId: data.noteId }, 201);
  } catch (error) {
    return handleError(error);
  }
}