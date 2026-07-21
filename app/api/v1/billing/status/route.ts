import { getBillingStatus } from "@/lib/billing";
import { handleError, ok, requireSession } from "@/lib/api/helpers";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    return ok(await getBillingStatus(session.user.id));
  } catch (error) {
    return handleError(error);
  }
}
