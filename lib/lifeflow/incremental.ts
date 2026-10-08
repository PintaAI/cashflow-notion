import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { ApiError } from "@/lib/api/helpers";
import { lifeFlowEntitySchema } from "./contract";
import { applyLifeFlowMutations, withLifeFlowTransaction } from "./store";

export const incrementalInput = z.object({
  cursor: z.string().max(2000).nullable().optional(),
  mutations: z.array(z.object({ mutationId: z.string().min(1).max(200), baseRevision: z.string().regex(/^\d+$/), entity: lifeFlowEntitySchema }).strict()).max(75),
}).strict();
type Input = z.infer<typeof incrementalInput>;
type Change = { revision: bigint; kind: string; entityId: string; payload: Record<string, unknown> | null; updatedAt: Date; deletedAt: Date | null };
type Cursor = { userId: string; epoch: string; after: string; upper: string; mode: "bootstrap" | "delta"; offset: number };
const cursorSchema = z.object({ userId: z.string(), epoch: z.string(), after: z.string().regex(/^\d+$/), upper: z.string().regex(/^\d+$/), mode: z.enum(["bootstrap", "delta"]), offset: z.number().int().nonnegative() }).strict();
const encode = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString("base64url");
const wire = (change: Change) => ({ kind: change.kind, id: change.entityId, updatedAt: change.updatedAt.toISOString(), deleted: change.deletedAt !== null, data: change.deletedAt ? null : change.payload });
function fingerprint(value: unknown): string {
  const canonical = (input: unknown): string => input && typeof input === "object"
    ? Array.isArray(input) ? `[${input.map(canonical).join(",")}]` : `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${canonical((input as Record<string, unknown>)[key])}`).join(",")}}`
    : JSON.stringify(input) ?? "null";
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export async function incrementalLifeFlow(userId: string, input: Input) {
  const results = await withLifeFlowTransaction(userId, async (tx) => {
    await tx.$executeRaw`INSERT INTO "LifeFlowSyncState"("userId") VALUES (${userId}) ON CONFLICT DO NOTHING`;
    const acknowledged: { mutationId: string; ok: true; entity: unknown; revision: string }[] = [];
    const fresh: Input["mutations"] = [];
    const seen = new Set<string>(), entityKeys = new Set<string>();
    for (const mutation of input.mutations) {
      if (seen.has(mutation.mutationId)) throw new ApiError("Duplicate mutationId", 400);
      seen.add(mutation.mutationId);
      const entityKey = `${mutation.entity.kind}\0${mutation.entity.id}`;
      if (entityKeys.has(entityKey)) throw new ApiError("Duplicate entity in mutation batch", 400);
      entityKeys.add(entityKey);
      const [receipt] = await tx.$queryRaw<{ fingerprint: string; result: typeof acknowledged[number] }[]>`
        SELECT fingerprint, result FROM "LifeFlowSyncReceipt" WHERE "userId" = ${userId} AND "mutationId" = ${mutation.mutationId}`;
      if (receipt) {
        if (receipt.fingerprint !== fingerprint(mutation)) throw new ApiError("Mutation identity reused with another payload", 409);
        acknowledged.push(receipt.result);
      } else fresh.push(mutation);
    }
    if (fresh.length) {
      const overwrite = new Set<string>();
      for (const mutation of fresh) {
        const [current] = await tx.$queryRaw<{ revision: bigint }[]>`
          SELECT revision FROM "LifeFlowChange" WHERE "userId" = ${userId} AND kind = ${mutation.entity.kind} AND "entityId" = ${mutation.entity.id} ORDER BY revision DESC LIMIT 1`;
        // An edit based on the current revision may have the same timestamp or
        // a slow device clock. Concurrent edits retain the legacy LWW policy.
        if (BigInt(mutation.baseRevision) === (current?.revision ?? BigInt(0))) overwrite.add(`${mutation.entity.kind}\0${mutation.entity.id}`);
      }
      try { await applyLifeFlowMutations(tx, userId, fresh.map((mutation) => mutation.entity), overwrite, false); }
      catch (error) {
        // Database/transaction failures remain retryable server errors.
        if (error instanceof Error && error.constructor === Error) throw new ApiError(error.message, 400);
        throw error;
      }
      for (const mutation of fresh) {
        const [change] = await tx.$queryRaw<Change[]>`
          SELECT * FROM "LifeFlowChange" WHERE "userId" = ${userId} AND kind = ${mutation.entity.kind} AND "entityId" = ${mutation.entity.id} ORDER BY revision DESC LIMIT 1`;
        const result = { mutationId: mutation.mutationId, ok: true as const, entity: wire(change), revision: String(change.revision) };
        await tx.$executeRaw`INSERT INTO "LifeFlowSyncReceipt"("userId", "mutationId", fingerprint, result) VALUES (${userId}, ${mutation.mutationId}, ${fingerprint(mutation)}, ${JSON.stringify(result)}::jsonb)`;
        acknowledged.push(result);
      }
    }
    return acknowledged;
  });

  // Fixed upper revision makes every continuation page a stable snapshot.
  const [state] = await prisma.$queryRaw<{ epoch: string; revision: bigint }[]>`SELECT epoch, revision FROM "LifeFlowSyncState" WHERE "userId" = ${userId}`;
  let cursor: Cursor = { userId, epoch: state.epoch, after: "0", upper: String(state.revision), mode: "bootstrap", offset: 0 };
  if (input.cursor) {
    try { cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString())); }
    catch { throw new ApiError("Invalid LifeFlow cursor", 400); }
    if (cursor.userId !== userId || cursor.epoch !== state.epoch || BigInt(cursor.upper) > state.revision || BigInt(cursor.after) > BigInt(cursor.upper)) {
      return { results, entities: [], revisions: [], nextCursor: null, hasMore: false, resetRequired: true };
    }
    if (cursor.mode === "delta" && cursor.after === cursor.upper) cursor.upper = String(state.revision);
  }
  const upper = BigInt(cursor.upper), after = BigInt(cursor.after);
  const rows = cursor.mode === "bootstrap"
    ? await prisma.$queryRaw<Change[]>`
        SELECT * FROM (SELECT DISTINCT ON (kind, "entityId") * FROM "LifeFlowChange"
          WHERE "userId" = ${userId} AND revision <= ${upper} AND kind IN ('item', 'habit_log', 'item_exception')
          ORDER BY kind, "entityId", revision DESC) snapshot
        ORDER BY CASE WHEN "deletedAt" IS NULL THEN CASE WHEN kind = 'item' THEN 0 ELSE 1 END ELSE CASE WHEN kind = 'item' THEN 3 ELSE 2 END END, kind, "entityId"
        LIMIT 201 OFFSET ${cursor.offset}`
    : await prisma.$queryRaw<Change[]>`SELECT * FROM "LifeFlowChange" WHERE "userId" = ${userId} AND revision > ${after} AND revision <= ${upper}
        AND kind IN ('item', 'habit_log', 'item_exception') ORDER BY revision LIMIT 201`;
  const hasMore = rows.length > 200, page = rows.slice(0, 200);
  const next: Cursor = hasMore
    ? { ...cursor, after: cursor.mode === "delta" ? String(page.at(-1)!.revision) : cursor.after, offset: cursor.offset + page.length }
    : { ...cursor, mode: "delta", after: cursor.upper, offset: 0 };
  return { results, entities: page.map(wire), revisions: page.map((row) => String(row.revision)), nextCursor: encode(next), hasMore, resetRequired: false };
}
