import { reconcileBilling } from "@/lib/billing";
import { handleError, ok, requireSession } from "@/lib/api/helpers";
import { RevenueCatApiError } from "@/lib/revenuecat";
import { isRateLimited, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if (await isRateLimited(`billing:reconcile:${session.user.id}:${requestIp(request)}`, 10, 60)) {
      return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
    return ok(await reconcileBilling(session.user.id));
  } catch (error) {
    if (error instanceof RevenueCatApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
