import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchQuickFills,
  addQuickFill,
} from "@/app/actions/quick-fill";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchQuickFills(managementId);
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
    const data = await addQuickFill({
      managementId: body.managementId,
      name: body.name,
      nominal: body.nominal,
      categoryId: body.categoryId ?? null,
    });
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}