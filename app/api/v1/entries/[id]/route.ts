import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { editEntry, removeEntry } from "@/app/actions/cashflow";
import { normalizeEntryAmount } from "@/lib/api/entry-amount";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    const amount = await normalizeEntryAmount(body);

    const entry = await editEntry(id, {
      ...body,
      ...amount,
    });

    return ok(entry);
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
    await removeEntry(id, managementId);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
