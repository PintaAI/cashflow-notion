import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { renameManagement } from "@/app/actions/management";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    if (!body?.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const result = await renameManagement(body.name, id);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}