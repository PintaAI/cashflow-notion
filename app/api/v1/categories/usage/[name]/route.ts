import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { checkCategoryUsage } from "@/app/actions/categories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    await requireSession(request);
    const { name } = await params;
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await checkCategoryUsage(
      decodeURIComponent(name),
      managementId,
    );
    return ok({ usageCount: data });
  } catch (error) {
    return handleError(error);
  }
}