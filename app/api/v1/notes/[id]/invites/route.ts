import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  getNoteInvitations,
  createNoteInvite,
  deleteNoteInvite,
} from "@/app/actions/notes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const data = await getNoteInvitations(id);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const code = await createNoteInvite(id);
    return ok({ code }, 201);
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
    const invitationId = searchParams.get("invitation_id");
    if (!invitationId) {
      return Response.json(
        { error: "invitation_id query param is required" },
        { status: 400 },
      );
    }
    const result = await deleteNoteInvite(id, invitationId);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}