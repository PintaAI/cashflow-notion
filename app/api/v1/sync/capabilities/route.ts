import { handleError, ok, requireSession } from "@/lib/api/helpers";
import { syncCapabilities } from "@/lib/sync/capabilities";

export async function GET(request: Request) {
  try { const session = await requireSession(request); return ok({ ...await syncCapabilities(), accountId: session.user.id }); }
  catch (error) { return handleError(error); }
}
