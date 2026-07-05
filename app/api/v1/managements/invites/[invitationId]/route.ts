import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { deleteInvite } from "@/app/actions/management";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  try {
    await requireSession(request);
    const { invitationId } = await params;
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const result = await deleteInvite(invitationId, managementId);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}