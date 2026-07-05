import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { acceptNoteInvite } from "@/app/actions/notes";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireSession(request);
    const { code } = await params;
    const result = await acceptNoteInvite(code);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}