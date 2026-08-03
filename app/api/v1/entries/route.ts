import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchEntriesFiltered, addEntry } from "@/app/actions/cashflow";
import type { IOType } from "@/lib/db";
import { normalizeEntryAmount } from "@/lib/api/entry-amount";
import { optionalClientId } from "@/lib/api/client-id";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);

    const data = await fetchEntriesFiltered({
      managementId: searchParams.get("management_id") ?? undefined,
      pageSize: searchParams.get("page_size")
        ? Number(searchParams.get("page_size"))
        : undefined,
      skip: searchParams.get("skip")
        ? Number(searchParams.get("skip"))
        : undefined,
      io: (searchParams.get("io") as IOType) ?? undefined,
      date: searchParams.get("date") ?? undefined,
      createdById: searchParams.get("created_by_id") ?? undefined,
    });

    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();

    if (!body?.name || typeof body.name !== "string") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const amount = await normalizeEntryAmount(body);
    if (typeof amount.nominal !== "number" || amount.nominal <= 0) {
      return Response.json(
        { error: "nominal or original amount must be a positive number" },
        { status: 400 },
      );
    }

    const entry = await addEntry({
      clientId: optionalClientId(body.clientId),
      managementId: body.managementId,
      name: body.name,
      nominal: amount.nominal,
      originalNominal: amount.originalNominal,
      originalCurrency: amount.originalCurrency,
      exchangeRateToIdr: amount.exchangeRateToIdr,
      exchangeRateAt: amount.exchangeRateAt,
      category: body.category,
      date: body.date,
      io: body.io,
    });

    return ok(entry, 201);
  } catch (error) {
    return handleError(error);
  }
}
