import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { convertCurrency } from "@/app/actions/currency-converter";

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (typeof body?.amount !== "number" || body.amount < 0) {
      return Response.json(
        { error: "amount must be a non-negative number" },
        { status: 400 },
      );
    }
    if (!body?.from || typeof body.from !== "string") {
      return Response.json({ error: "from is required" }, { status: 400 });
    }
    if (!body?.to || typeof body.to !== "string") {
      return Response.json({ error: "to is required" }, { status: 400 });
    }
    const data = await convertCurrency(body.amount, body.from, body.to);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}