import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchProfileTheme,
  saveProfileTheme,
} from "@/app/actions/profile";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const data = await fetchProfileTheme();
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (body?.theme === undefined) {
      return Response.json({ error: "theme is required" }, { status: 400 });
    }
    await saveProfileTheme(body.theme);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}