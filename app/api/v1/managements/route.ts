import { requireSession, ok, handleError } from "@/lib/api/helpers";
import { getUserManagements, createManagement } from "@/app/actions/management";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await getUserManagements();
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
    const result = await createManagement(body.name);
    return ok(result, 201);
  } catch (error) {
    return handleError(error);
  }
}