import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  getManagementInvitations,
  createInvite,
} from "@/app/actions/management";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession(request);
    const { id } = await params;
    const data = await getManagementInvitations(id);
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
    const code = await createInvite(id);
    return ok({ code }, 201);
  } catch (error) {
    return handleError(error);
  }
}