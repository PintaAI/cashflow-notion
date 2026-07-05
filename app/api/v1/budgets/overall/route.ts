import { requireSession, ok, handleError } from "@/lib/api/helpers";
import {
  fetchOverallBudgets,
  saveOverallBudget,
  removeOverallBudget,
} from "@/app/actions/budgets";
import type { BudgetPeriod } from "@/lib/db";

const VALID_PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly", "yearly"];

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const managementId = searchParams.get("management_id") ?? undefined;
    const data = await fetchOverallBudgets(managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await requireSession(request);
    const body = await request.json();
    if (!body?.period || !VALID_PERIODS.includes(body.period)) {
      return Response.json(
        { error: "period must be daily, weekly, monthly, or yearly" },
        { status: 400 },
      );
    }
    if (typeof body?.amount !== "number" || body.amount < 0) {
      return Response.json(
        { error: "amount must be a non-negative number" },
        { status: 400 },
      );
    }
    const data = await saveOverallBudget(body.period, body.amount, body.managementId);
    return ok(data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSession(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") as BudgetPeriod | null;
    if (!period || !VALID_PERIODS.includes(period)) {
      return Response.json(
        { error: "period query param is required (daily, weekly, monthly, yearly)" },
        { status: 400 },
      );
    }
    const managementId = searchParams.get("management_id") ?? undefined;
    await removeOverallBudget(period, managementId);
    return ok({ success: true });
  } catch (error) {
    return handleError(error);
  }
}