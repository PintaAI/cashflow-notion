import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { updateNoteContent } from "@/app/actions/notes";
import { deriveContentFromJson } from "@/lib/notes/server-util";

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

    let derived;
    try {
      derived = await deriveContentFromJson(body.contentJson);
    } catch {
      return Response.json(
        { error: "contentJson is not valid JSON or not a valid BlockNote document" },
        { status: 400 },
      );
    }

    const result = await updateNoteContent(id, {
      contentJson: body.contentJson,
      html: derived.html,
      markdown: derived.markdown,
      expectedUpdatedAt: body.expectedUpdatedAt ?? undefined,
    });

    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
