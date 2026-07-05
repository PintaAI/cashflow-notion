import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { switchManagement } from "@/app/actions/management";

export async function PATCH(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (!body?.managementId || typeof body.managementId !== "string") {
      return Response.json({ error: "managementId is required" }, { status: 400 });
    }
    const result = await switchManagement(body.managementId);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}