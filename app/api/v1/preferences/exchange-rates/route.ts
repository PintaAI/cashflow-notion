import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchExchangeRates } from "@/app/actions/preferences";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await fetchExchangeRates();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}