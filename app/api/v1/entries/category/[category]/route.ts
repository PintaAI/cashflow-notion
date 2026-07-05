import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { fetchCategoryEntries } from "@/app/actions/cashflow";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ category: string }> },
) {
  try {
    await requireSession(request);
    const { category } = await params;
    const { searchParams } = new URL(request.url);

    const data = await fetchCategoryEntries(decodeURIComponent(category), {
      managementId: searchParams.get("management_id") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
    });

    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}