import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchUserCurrency,
  updateUserCurrency,
} from "@/app/actions/preferences";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await fetchUserCurrency();
    return ok({ currency: data });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (!body?.currency || typeof body.currency !== "string") {
      return Response.json({ error: "currency is required" }, { status: 400 });
    }
    await updateUserCurrency(body.currency);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}