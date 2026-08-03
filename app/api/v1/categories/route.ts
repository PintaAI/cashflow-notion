import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchCategories,
  fetchCategoriesWithDetails,
  createCategory,
} from "@/app/actions/categories";
import { optionalClientId } from "@/lib/api/client-id";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const detailed = searchParams.get("detailed") === "true";
    const data = detailed
      ? await fetchCategoriesWithDetails(managementId)
      : await fetchCategories(managementId);
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
    const clientId = optionalClientId(body.clientId);
    const data = await createCategory(
      body.name,
      body.color,
      body.icon,
      body.budgets,
      body.managementId,
      clientId,
    );
    const created = clientId
      ? data.find((category) => category.id === clientId)
      : data.find((category) => category.name === body.name.trim());
    if (!created) throw new Error("Created category not found");
    return ok(created, 201);
  } catch (error) {
    return handleError(error);
  }
}
