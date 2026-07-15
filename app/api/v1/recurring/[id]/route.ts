import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { editRecurringEntry, removeRecurringEntry } from "@/app/actions/recurring";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    if (
      body.reminderTime !== undefined &&
      (typeof body.reminderTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminderTime))
    ) {
      return Response.json({ error: "reminderTime must use HH:mm format" }, { status: 400 });
    }
    const data = await editRecurringEntry(id, {
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
    await removeRecurringEntry(id, managementId);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
