import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { searchRegisteredUsers } from "@/app/actions/users";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const data = await searchRegisteredUsers(q);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}