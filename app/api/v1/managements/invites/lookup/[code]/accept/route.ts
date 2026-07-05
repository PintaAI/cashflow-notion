import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { acceptInvite } from "@/app/actions/management";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireSession(request);
    const { code } = await params;
    const result = await acceptInvite(code);
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}