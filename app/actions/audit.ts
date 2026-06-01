"use server";

import {
  getBalanceAsOf,
  createAuditSnapshot,
  getAuditHistory,
  getLatestAuditSnapshot,
  type AuditSnapshotData,
} from "@/lib/db";
import { getCurrentManagementId, getSession } from "@/lib/management";

export async function fetchBalance(): Promise<number> {
  const managementId = await getCurrentManagementId();
  return getBalanceAsOf(managementId);
}

export async function fetchAuditHistory(): Promise<AuditSnapshotData[]> {
  const managementId = await getCurrentManagementId();
  return getAuditHistory(managementId);
}

export async function fetchLatestAudit(): Promise<AuditSnapshotData | null> {
  const managementId = await getCurrentManagementId();
  return getLatestAuditSnapshot(managementId);
}

export async function performAudit(params: {
  actualBalance: number;
  note?: string;
  autoAdjust: boolean;
}): Promise<AuditSnapshotData> {
  const managementId = await getCurrentManagementId();
  const session = await getSession();
  if (!session?.user.id) throw new Error("Not authenticated");

  return createAuditSnapshot({
    managementId,
    userId: session.user.id,
    actualBalance: params.actualBalance,
    note: params.note,
    autoAdjust: params.autoAdjust,
  });
}
