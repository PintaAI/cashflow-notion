import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { updateNoteTitle } from "@/app/actions/notes";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    if (!body?.title || typeof body.title !== "string") {
      return Response.json({ error: "title is required" }, { status: 400 });
    }
    const result = await updateNoteTitle(id, body.title);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}