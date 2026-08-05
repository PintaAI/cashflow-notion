import { handleError, ok, requireSession } from "@/lib/api/helpers";
import { lifeFlowSyncSchema } from "@/lib/lifeflow/contract";
import { assertLifeFlowMembership, syncLifeFlow } from "@/lib/lifeflow/store";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    const parsed = lifeFlowSyncSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: `Invalid LifeFlow sync payload: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}` }, { status: 400 });
    }
    const input = parsed.data;
    await assertLifeFlowMembership(session.user.id, input.managementId);
    return ok({ entities: await syncLifeFlow(input.managementId, input.entities) });
  } catch (error) {
    return handleError(error);
  }
}
