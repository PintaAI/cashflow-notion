import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { regenerateMcpApiKey } from "@/app/actions/management";

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const key = await regenerateMcpApiKey();
    return ok({ apiKey: key }, 201);
  } catch (error) {
    return handleError(error);
  }
}