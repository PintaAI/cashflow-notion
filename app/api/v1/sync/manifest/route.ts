import { ApiError, handleError, ok, requireSession } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/client";
import { syncCapabilities } from "@/lib/sync/capabilities";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const managementId = new URL(request.url).searchParams.get("management_id");
    if (!managementId) throw new ApiError("management_id is required", 400);
    const member = await prisma.managementMember.findFirst({ where: { managementId, userId: session.user.id } });
    if (!member) throw new ApiError("Forbidden", 403);
    if (!(await syncCapabilities()).metadata) throw new ApiError("Sync manifest unavailable", 404);
    await prisma.$executeRaw`INSERT INTO "WalletSyncRevision"("managementId") VALUES (${managementId}) ON CONFLICT DO NOTHING`;
    const [state] = await prisma.$queryRaw<{ epoch: string; categories: bigint; quickFills: bigint; budgets: bigint; recurring: bigint }[]>`
      SELECT * FROM "WalletSyncRevision" WHERE "managementId" = ${managementId}`;
    return ok({ managementId, categories: `${state.epoch}:${state.categories}`, quickFills: `${state.epoch}:${state.quickFills}`, budgets: `${state.epoch}:${state.budgets}`, recurring: `${state.epoch}:${state.recurring}` });
  } catch (error) { return handleError(error); }
}
