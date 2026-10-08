import { ApiError, handleError, ok, requireSession } from "@/lib/api/helpers";
import { incrementalInput, incrementalLifeFlow } from "@/lib/lifeflow/incremental";
import { syncCapabilities } from "@/lib/sync/capabilities";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    if ((await syncCapabilities()).lifeFlow !== 2) throw new ApiError("Incremental sync unavailable", 404);
    const input = incrementalInput.safeParse(await request.json());
    if (!input.success) throw new ApiError(`Invalid LifeFlow sync payload: ${input.error.message}`, 400);
    return ok(await incrementalLifeFlow(session.user.id, input.data));
  } catch (error) { return handleError(error); }
}
