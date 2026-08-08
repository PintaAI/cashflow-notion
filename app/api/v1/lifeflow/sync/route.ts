import { handleError, ok, requireSession } from "@/lib/api/helpers";
import { lifeFlowSyncSchema } from "@/lib/lifeflow/contract";
import { syncLifeFlow } from "@/lib/lifeflow/store";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    const parsed = lifeFlowSyncSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: `Invalid LifeFlow sync payload: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}` }, { status: 400 });
    }
    const input = parsed.data;
    return ok({ entities: await syncLifeFlow(session.user.id, input.entities) });
  } catch (error) {
    return handleError(error);
  }
}
