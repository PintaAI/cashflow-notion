import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { updateCategory, deleteCategory } from "@/app/actions/categories";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    const data = await updateCategory(id, {
      ...body,
      managementId: body.managementId,
    });
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await deleteCategory(id, managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}