import { Prisma, type IOType } from "@prisma/client";

import { prisma } from "@/lib/db/client";

const CURSOR_VERSION = 1;
export const ENTRY_SYNC_PAGE_SIZE = 200;
export const ENTRY_SYNC_BATCH_SIZE = 100;
export const ENTRY_SYNC_MUTATION_RETENTION_DAYS = 90;
export const ENTRY_SYNC_MUTATION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastMutationCleanupAt = 0;

type CursorPayload = { v: number; m: string; u: string; i: string };

export type EntrySyncRecord = {
  id: string;
  name: string;
  nominal: number;
  originalNominal: number | null;
  originalCurrency: string | null;
  exchangeRateToIdr: number | null;
  exchangeRateAt: string | null;
  categoryId: string | null;
  date: string | null;
  io: IOType | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function encodeEntrySyncCursor(managementId: string, updatedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, m: managementId, u: updatedAt.toISOString(), i: id } satisfies CursorPayload)).toString("base64url");
}

export function decodeEntrySyncCursor(cursor: string, managementId: string): { updatedAt: Date; id: string } {
  let payload: CursorPayload;
  try {
    payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
  } catch {
    throw new Error("Invalid entry sync cursor");
  }
  const updatedAt = new Date(payload.u);
  if (payload.v !== CURSOR_VERSION || payload.m !== managementId || typeof payload.i !== "string" || Number.isNaN(updatedAt.getTime())) {
    throw new Error("Invalid entry sync cursor");
  }
  return { updatedAt, id: payload.i };
}

function toSyncRecord(entry: {
  id: string; name: string; nominal: number; originalNominal: number | null; originalCurrency: string | null;
  exchangeRateToIdr: number | null; exchangeRateAt: Date | null; categoryId: string | null; date: string | null;
  io: IOType | null; createdById: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null;
}): EntrySyncRecord {
  return { ...entry, exchangeRateAt: entry.exchangeRateAt?.toISOString() ?? null, createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString(), deletedAt: entry.deletedAt?.toISOString() ?? null };
}

export async function getEntrySyncPage(managementId: string, cursor?: string, limit = ENTRY_SYNC_PAGE_SIZE) {
  const decoded = cursor ? decodeEntrySyncCursor(cursor, managementId) : null;
  const rows = await prisma.entry.findMany({
    where: {
      managementId,
      ...(decoded ? { OR: [{ updatedAt: { gt: decoded.updatedAt } }, { updatedAt: decoded.updatedAt, id: { gt: decoded.id } }] } : {}),
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), ENTRY_SYNC_PAGE_SIZE) + 1,
    select: {
      id: true, name: true, nominal: true, originalNominal: true, originalCurrency: true, exchangeRateToIdr: true,
      exchangeRateAt: true, categoryId: true, date: true, io: true, createdById: true, createdAt: true, updatedAt: true, deletedAt: true,
    },
  });
  const pageSize = Math.min(Math.max(limit, 1), ENTRY_SYNC_PAGE_SIZE);
  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    entries: page.map(toSyncRecord),
    hasMore: rows.length > page.length,
    nextCursor: last ? encodeEntrySyncCursor(managementId, last.updatedAt, last.id) : cursor ?? encodeEntrySyncCursor(managementId, new Date(0), ""),
  };
}

export type EntrySyncMutation = {
  mutationId: string;
  operation: "create" | "update" | "delete";
  entryId?: string;
  clientId?: string;
  data?: {
    name?: string; nominal?: number; originalNominal?: number; originalCurrency?: string; exchangeRateToIdr?: number;
    exchangeRateAt?: string; categoryId?: string | null; date?: string; io?: IOType;
  };
};

export type EntrySyncMutationResult = { mutationId: string; ok: true; entry: EntrySyncRecord } | { mutationId: string; ok: false; error: string };

export function decideCreateRetry(existingManagementId: string | null, requestedManagementId: string): "create" | "update" | "forbidden" {
  if (existingManagementId === null) return "create";
  return existingManagementId === requestedManagementId ? "update" : "forbidden";
}

export function storedMutationResult(prior: { result: unknown } | null): EntrySyncMutationResult | null {
  return prior ? prior.result as EntrySyncMutationResult : null;
}

export async function cleanupExpiredEntrySyncMutations(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - ENTRY_SYNC_MUTATION_RETENTION_DAYS);
  const result = await prisma.entrySyncMutation.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}

export function isEntrySyncMutationCleanupDue(lastCleanupAt: number, now = Date.now()): boolean {
  return lastCleanupAt <= 0 || now - lastCleanupAt >= ENTRY_SYNC_MUTATION_CLEANUP_INTERVAL_MS;
}

async function maybeCleanupExpiredEntrySyncMutations(now = Date.now()): Promise<void> {
  if (!isEntrySyncMutationCleanupDue(lastMutationCleanupAt, now)) return;
  // Gate before awaiting so concurrent batches in this process do not start duplicate cleanup queries.
  lastMutationCleanupAt = now;
  await cleanupExpiredEntrySyncMutations(new Date(now)).catch((error) => {
    console.warn("[entry-sync] mutation receipt cleanup failed", error);
  });
}

async function applyMutation(managementId: string, userId: string, mutation: EntrySyncMutation): Promise<EntrySyncMutationResult> {
  if (!mutation.mutationId || !["create", "update", "delete"].includes(mutation.operation)) {
    return { mutationId: mutation.mutationId || "invalid", ok: false, error: "Invalid mutation" };
  }
  const prior = await prisma.entrySyncMutation.findUnique({ where: { managementId_mutationId: { managementId, mutationId: mutation.mutationId } } });
  const priorResult = storedMutationResult(prior);
  if (priorResult) return priorResult;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const data = mutation.data ?? {};
      if (data.name !== undefined && !data.name.trim()) throw new Error("name cannot be empty");
      if (data.nominal !== undefined && (!Number.isFinite(data.nominal) || data.nominal <= 0)) throw new Error("nominal must be greater than 0");
      if (data.exchangeRateAt !== undefined && Number.isNaN(Date.parse(data.exchangeRateAt))) throw new Error("Invalid exchangeRateAt");
      if (data.categoryId) {
        const category = await tx.category.findFirst({ where: { id: data.categoryId, managementId }, select: { id: true } });
        if (!category) throw new Error("Category not found");
      }
      const common = {
        ...(data.name !== undefined ? { name: data.name } : {}), ...(data.nominal !== undefined ? { nominal: data.nominal } : {}),
        ...(data.originalNominal !== undefined ? { originalNominal: data.originalNominal } : {}), ...(data.originalCurrency !== undefined ? { originalCurrency: data.originalCurrency } : {}),
        ...(data.exchangeRateToIdr !== undefined ? { exchangeRateToIdr: data.exchangeRateToIdr } : {}), ...(data.exchangeRateAt !== undefined ? { exchangeRateAt: new Date(data.exchangeRateAt) } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}), ...(data.date !== undefined ? { date: data.date } : {}), ...(data.io !== undefined ? { io: data.io } : {}),
      };
      let entry;
      if (mutation.operation === "create") {
        if (!mutation.clientId || !data.name || !data.nominal || !data.io) throw new Error("Create fields are required");
        const existing = await tx.entry.findUnique({ where: { id: mutation.clientId }, select: { managementId: true } });
        const decision = decideCreateRetry(existing?.managementId ?? null, managementId);
        if (decision === "forbidden") throw new Error("Entry not found");
        const createData = { id: mutation.clientId, name: data.name, nominal: data.nominal, originalNominal: data.originalNominal ?? data.nominal, originalCurrency: data.originalCurrency ?? "IDR", exchangeRateToIdr: data.exchangeRateToIdr ?? 1, exchangeRateAt: data.exchangeRateAt ? new Date(data.exchangeRateAt) : new Date(), categoryId: data.categoryId, date: data.date, io: data.io, managementId, createdById: userId };
        entry = decision === "create"
          ? await tx.entry.create({ data: createData })
          : await tx.entry.update({ where: { id: mutation.clientId }, data: { ...common, deletedAt: null } });
      } else {
        if (!mutation.entryId) throw new Error("entryId is required");
        const existing = await tx.entry.findFirst({ where: { id: mutation.entryId, managementId } });
        if (!existing) throw new Error("Entry not found");
        entry = await tx.entry.update({ where: { id: existing.id }, data: mutation.operation === "delete" ? { deletedAt: new Date() } : { ...common, deletedAt: null } });
      }
      const value: EntrySyncMutationResult = { mutationId: mutation.mutationId, ok: true, entry: toSyncRecord(entry) };
      await tx.entrySyncMutation.create({ data: { managementId, mutationId: mutation.mutationId, result: value as unknown as Prisma.InputJsonValue } });
      return value;
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const prior = await prisma.entrySyncMutation.findUnique({ where: { managementId_mutationId: { managementId, mutationId: mutation.mutationId } } });
      const priorResult = storedMutationResult(prior);
      if (priorResult) return priorResult;
    }
    return { mutationId: mutation.mutationId, ok: false, error: error instanceof Error ? error.message : "Mutation failed" };
  }
}

export async function applyEntrySyncMutations(managementId: string, userId: string, mutations: EntrySyncMutation[]) {
  if (mutations.length === 0 || mutations.length > ENTRY_SYNC_BATCH_SIZE) throw new Error(`mutations must contain 1-${ENTRY_SYNC_BATCH_SIZE} items`);
  await maybeCleanupExpiredEntrySyncMutations();
  const results: EntrySyncMutationResult[] = [];
  for (const mutation of mutations) results.push(await applyMutation(managementId, userId, mutation));
  return results;
}
