import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchActivityOverview } from "@/app/actions/analytics";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const daysBack = searchParams.get("days_back")
      ? Number(searchParams.get("days_back"))
      : undefined;
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchActivityOverview(daysBack, managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}