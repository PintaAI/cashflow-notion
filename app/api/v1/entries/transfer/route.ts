import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { transferBetweenManagements } from "@/app/actions/cashflow";

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();

    if (!body?.toManagementId || typeof body.toManagementId !== "string") {
      return Response.json(
        { error: "toManagementId is required" },
        { status: 400 },
      );
    }
    if (typeof body?.nominal !== "number" || body.nominal <= 0) {
      return Response.json(
        { error: "nominal must be a positive number" },
        { status: 400 },
      );
    }

    const result = await transferBetweenManagements({
      fromManagementId: body.fromManagementId,
      toManagementId: body.toManagementId,
      nominal: body.nominal,
      originalNominal: body.originalNominal,
      originalCurrency: body.originalCurrency,
      exchangeRateToIdr: body.exchangeRateToIdr,
      exchangeRateAt: body.exchangeRateAt
        ? new Date(body.exchangeRateAt)
        : undefined,
      date: body.date,
      note: body.note,
    });

    return ok(result, 201);
  } catch (error) {
    return handleError(error);
  }
}