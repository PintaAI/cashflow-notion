import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { removeManagementMember } from "@/app/actions/management";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    await requireSession(request);
    const { id, memberId } = await params;
    const result = await removeManagementMember(memberId, id);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}