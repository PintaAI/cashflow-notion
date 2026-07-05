import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { togglePinNote } from "@/app/actions/notes";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const result = await togglePinNote(id);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}