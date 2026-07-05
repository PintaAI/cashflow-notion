import { ok, handleError } from "@/lib/api/helpers";
import { getInvitationInfo } from "@/app/actions/management";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const data = await getInvitationInfo(code);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}