import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchCategories,
  fetchCategoriesWithDetails,
  createCategory,
} from "@/app/actions/categories";

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
    const data = await createCategory(
      body.name,
      body.color,
      body.icon,
      body.budgets,
      body.managementId,
    );
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}