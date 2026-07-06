import { deleteAccount } from "@/lib/account-deletion";
import { handleError, ok, requireSession } from "@/lib/api/helpers";

export async function DELETE(request: Request) {
  try {
    const session = await requireSession(request);
    const result = await deleteAccount(session.user.id);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
