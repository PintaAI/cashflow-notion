import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchRecurringEntries,
  addRecurringEntry,
} from "@/app/actions/recurring";
import type { IOType, RecurringFrequency } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchRecurringEntries(managementId);
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
    if (typeof body?.nominal !== "number" || body.nominal <= 0) {
      return Response.json(
        { error: "nominal must be a positive number" },
        { status: 400 },
      );
    }
    if (!body?.io || !["Income", "Expenses"].includes(body.io)) {
      return Response.json({ error: "io must be Income or Expenses" }, { status: 400 });
    }
    if (!body?.frequency || !["daily", "weekly", "monthly", "yearly"].includes(body.frequency)) {
      return Response.json(
        { error: "frequency must be daily, weekly, monthly, or yearly" },
        { status: 400 },
      );
    }
    if (!body?.startDate || typeof body.startDate !== "string") {
      return Response.json({ error: "startDate is required" }, { status: 400 });
    }
    if (typeof body?.reminderTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.reminderTime)) {
      return Response.json({ error: "reminderTime must use HH:mm format" }, { status: 400 });
    }

    const data = await addRecurringEntry({
      managementId: body.managementId,
      name: body.name,
      nominal: body.nominal,
      categoryId: body.categoryId ?? null,
      io: body.io as IOType,
      frequency: body.frequency as RecurringFrequency,
      reminderTime: body.reminderTime,
      dayOfWeek: body.dayOfWeek ?? null,
      dayOfMonth: body.dayOfMonth ?? null,
      monthOfYear: body.monthOfYear ?? null,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
    });
    return ok(data, 201);
  } catch (error) {
    return handleError(error);
  }
}
