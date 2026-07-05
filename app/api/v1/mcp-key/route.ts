import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { getMcpApiKey, regenerateMcpApiKey } from "@/app/actions/management";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await getMcpApiKey();
    return ok({ apiKey: data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const key = await regenerateMcpApiKey();
    return ok({ apiKey: key }, 201);
  } catch (error) {
    return handleError(error);
  }
}