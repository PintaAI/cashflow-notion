import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchSummary } from "@/app/actions/cashflow";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchSummary(managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}