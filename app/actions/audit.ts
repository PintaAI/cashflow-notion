"use server";

import {
  getBalanceAsOf,
  createAuditSnapshot,
  getAuditHistory,
  getLatestAuditSnapshot,
  type AuditSnapshotData,
} from "@/lib/db";
import { getSession, resolveManagementId } from "@/lib/management";

export async function fetchBalance(managementId?: string): Promise<number> {
  managementId = await resolveManagementId(managementId);
  return getBalanceAsOf(managementId);
}

export async function fetchAuditHistory(managementId?: string): Promise<AuditSnapshotData[]> {
  managementId = await resolveManagementId(managementId);
  return getAuditHistory(managementId);
}

export async function fetchLatestAudit(managementId?: string): Promise<AuditSnapshotData | null> {
  managementId = await resolveManagementId(managementId);
  return getLatestAuditSnapshot(managementId);
}

export async function performAudit(params: {
  managementId?: string;
  actualBalance: number;
  note?: string;
  autoAdjust: boolean;
}): Promise<AuditSnapshotData> {
  const managementId = await resolveManagementId(params.managementId);
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
