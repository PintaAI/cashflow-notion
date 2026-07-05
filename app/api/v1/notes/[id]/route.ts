import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { getUserNote, deleteNote } from "@/app/actions/notes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const data = await getUserNote(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const result = await deleteNote(id);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}