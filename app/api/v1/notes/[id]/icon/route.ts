import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { updateNoteIcon } from "@/app/actions/notes";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    if (!body?.icon || typeof body.icon !== "string") {
      return Response.json({ error: "icon is required" }, { status: 400 });
    }
    if (!body?.iconType || !["hugeicon", "emoji"].includes(body.iconType)) {
      return Response.json(
        { error: "iconType must be hugeicon or emoji" },
        { status: 400 },
      );
    }
    if (!body?.iconColor || typeof body.iconColor !== "string") {
      return Response.json({ error: "iconColor is required" }, { status: 400 });
    }
    const result = await updateNoteIcon(id, {
      icon: body.icon,
      iconType: body.iconType,
      iconColor: body.iconColor,
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}