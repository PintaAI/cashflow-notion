import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchCalendarEntries } from "@/app/actions/cashflow";
import type { IOType } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);

    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!year || !month || month < 1 || month > 12) {
      return Response.json(
        { error: "year and month (1-12) are required" },
        { status: 400 },
      );
    }

    const io = (searchParams.get("io") as IOType) ?? undefined;
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchCalendarEntries(year, month, io, managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}