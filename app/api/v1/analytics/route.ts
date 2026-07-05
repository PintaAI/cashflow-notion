import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchAnalytics } from "@/app/actions/analytics";
import type { AnalyticsFilter } from "@/lib/analytics";
import type { IOType } from "@/lib/db";

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const filter: AnalyticsFilter = {
      io: (body.io ?? (searchParams.get("io") as IOType)) ?? undefined,
      category: body.category ?? searchParams.get("category") ?? undefined,
      startDate: body.startDate ?? searchParams.get("start_date") ?? undefined,
      endDate: body.endDate ?? searchParams.get("end_date") ?? undefined,
    };

    const managementId =
      body.managementId ?? searchParams.get("management_id") ?? undefined;

    const data = await fetchAnalytics(filter, managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}