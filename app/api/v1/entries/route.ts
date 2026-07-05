import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchEntriesFiltered, addEntry } from "@/app/actions/cashflow";
import type { IOType } from "@/lib/db";

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
    if (typeof body?.nominal !== "number" || body.nominal <= 0) {
      return Response.json(
        { error: "nominal must be a positive number" },
        { status: 400 },
      );
    }

    const entry = await addEntry({
      managementId: body.managementId,
      name: body.name,
      nominal: body.nominal,
      originalNominal: body.originalNominal,
      originalCurrency: body.originalCurrency,
      exchangeRateToIdr: body.exchangeRateToIdr,
      exchangeRateAt: body.exchangeRateAt ? new Date(body.exchangeRateAt) : undefined,
      category: body.category,
      date: body.date,
      io: body.io,
    });

    return ok(entry, 201);
  } catch (error) {
    return handleError(error);
  }
}