import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { updateNoteContent } from "@/app/actions/notes";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const body = await request.json();
    if (!body?.contentJson || typeof body.contentJson !== "string") {
      return Response.json({ error: "contentJson is required" }, { status: 400 });
    }
    if (typeof body.html !== "string" || typeof body.markdown !== "string") {
      return Response.json(
        { error: "html and markdown are required" },
        { status: 400 },
      );
    }
    const result = await updateNoteContent(id, {
      contentJson: body.contentJson,
      html: body.html,
      markdown: body.markdown,
    });
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}