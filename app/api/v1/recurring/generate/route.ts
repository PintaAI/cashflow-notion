import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { runRecurringGeneration } from "@/app/actions/recurring";

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const count = await runRecurringGeneration(managementId);
    return ok({ generated: count });
  } catch (error) {
    return handleError(error);
  }
}