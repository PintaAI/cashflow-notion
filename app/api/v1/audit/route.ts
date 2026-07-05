import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchAuditHistory, performAudit } from "@/app/actions/audit";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchAuditHistory(managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (typeof body?.actualBalance !== "number") {
      return Response.json(
        { error: "actualBalance is required" },
        { status: 400 },
      );
    }
    const data = await performAudit({
      managementId: body.managementId,
      actualBalance: body.actualBalance,
      note: body.note,
      autoAdjust: body.autoAdjust ?? false,
    });
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}