import { NextResponse } from "next/server";
import { generateRecurringEntries } from "@/lib/db";
import { getCurrentManagementId } from "@/lib/management";

export async function POST() {
  try {
    const managementId = await getCurrentManagementId();
    const count = await generateRecurringEntries(managementId);
    return NextResponse.json({ generated: count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate entries" },
      { status: 500 },
    );
  }
}
