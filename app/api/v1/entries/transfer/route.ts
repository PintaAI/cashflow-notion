import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { transferBetweenManagements } from "@/app/actions/cashflow";
import { normalizeEntryAmount } from "@/lib/api/entry-amount";

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
    const amount = await normalizeEntryAmount(body);
    if (typeof amount.nominal !== "number" || amount.nominal <= 0) {
      return Response.json(
        { error: "nominal or original amount must be a positive number" },
        { status: 400 },
      );
    }

    const result = await transferBetweenManagements({
      fromManagementId: body.fromManagementId,
      toManagementId: body.toManagementId,
      nominal: amount.nominal,
      originalNominal: amount.originalNominal,
      originalCurrency: amount.originalCurrency,
      exchangeRateToIdr: amount.exchangeRateToIdr,
      exchangeRateAt: amount.exchangeRateAt,
      date: body.date,
      note: body.note,
    });

    return ok(result, 201);
  } catch (error) {
    return handleError(error);
  }
}
