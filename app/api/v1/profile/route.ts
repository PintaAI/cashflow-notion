import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { updateProfile } from "@/app/actions/profile";

export async function PUT(request: Request) {
  try {
    await requireSession(request);
    const formData = await request.formData();
    const result = await updateProfile({ status: "idle", message: "" }, formData);
    if (result.status === "error") {
      return Response.json({ error: result.message }, { status: 400 });
    }
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}