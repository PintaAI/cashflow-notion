import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { getAllCurrencyRates } from "@/app/actions/currency-converter";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await getAllCurrencyRates();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}