import { updateManagementImage } from "@/app/actions/management";
import { handleError, ok, requireSession } from "@/lib/api/helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const formData = await request.formData();
    formData.set("managementId", id);

    const result = await updateManagementImage({ status: "idle", message: "" }, formData);
    if (result.status === "error") {
      return Response.json({ error: result.message }, { status: 400 });
    }

    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
