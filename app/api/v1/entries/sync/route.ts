import { applyEntrySyncMutations, getEntrySyncPage } from "@/lib/entry-sync";
import { handleError, ok, requireSession } from "@/lib/api/helpers";
import { assertManagementAccess } from "@/lib/management";

export async function GET(request: Request) {
  const started = performance.now();
  try {
    await requireSession(request);
    const params = new URL(request.url).searchParams;
    const managementId = params.get("management_id");
    if (!managementId) return Response.json({ error: "management_id is required" }, { status: 400 });
    await assertManagementAccess(managementId);
    const page = await getEntrySyncPage(managementId, params.get("cursor") ?? undefined, params.get("limit") ? Number(params.get("limit")) : undefined);
    console.info("[entry-sync] pull", { count: page.entries.length, hasMore: page.hasMore, durationMs: Math.round(performance.now() - started) });
    return ok(page);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const started = performance.now();
  try {
    const session = await requireSession(request);
    const body = await request.json();
    if (!body?.managementId || !Array.isArray(body.mutations)) return Response.json({ error: "managementId and mutations are required" }, { status: 400 });
    await assertManagementAccess(body.managementId);
    const results = await applyEntrySyncMutations(body.managementId, session.user.id, body.mutations);
    console.info("[entry-sync] push", { count: results.length, failed: results.filter((result) => !result.ok).length, durationMs: Math.round(performance.now() - started) });
    return ok({ results });
  } catch (error) {
    return handleError(error);
  }
}
