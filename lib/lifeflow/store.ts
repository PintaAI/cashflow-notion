import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";
import { assertCanonicalSystemItem, assertItemDefinitionMutation, assertSystemSyncMutation, habitLogPayloadSchema, itemExceptionPayloadSchema, itemPayloadSchema, lifeFlowKinds, type ItemPayload, type LifeFlowSyncEntity } from "@/lib/lifeflow/contract";
import { recurrenceApplies } from "@/lib/lifeflow/resolve-day";
import { selectEffectiveLifeFlowMutations } from "@/lib/lifeflow/sync-plan";

export async function withLifeFlowTransaction<T>(userId: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 78115))::text`;
    return work(tx);
  }, { timeout: 30000 });
}

export async function applyLifeFlowMutations(tx: Prisma.TransactionClient, userId: string, entities: LifeFlowSyncEntity[], overwrite = new Set<string>(), snapshot = true) {
  if (!entities.length && !snapshot) return [];
  const parents = [...new Set(entities.map((entity) => entity.kind === "item" ? entity.id : entity.id.slice(0, entity.id.lastIndexOf("|"))))];
  const changedItems = entities.filter((entity) => entity.kind === "item").map((entity) => entity.id);
  const identities = entities.map((entity) => Prisma.sql`(kind = ${entity.kind} AND "entityId" = ${entity.id})`);
  const stored = await tx.$queryRaw<{ kind: string; entityId: string; payload: Prisma.JsonValue | null; deletedAt: Date | null; updatedAt: Date }[]>(Prisma.sql`
    SELECT kind, "entityId", payload, "deletedAt", "updatedAt" FROM "LifeFlowEntity"
    WHERE "userId" = ${userId} AND (
      (kind = 'item' AND "entityId" = ANY(${[...parents, "lifeflow-app-check-in", "lifeflow-journal"]}::text[]))
      OR (kind IN ('habit_log', 'item_exception') AND payload->>'item_id' = ANY(${changedItems}::text[]))
      ${identities.length ? Prisma.sql`OR (${Prisma.join(identities, " OR ")})` : Prisma.empty}
    )`);
  const keyOf = (entity: { kind: string; entityId: string }) => `${entity.kind}\0${entity.entityId}`;
  const chosen = selectEffectiveLifeFlowMutations(stored, entities);
  const effective = [...chosen, ...entities.filter((entity) => overwrite.has(`${entity.kind}\0${entity.id}`) && !chosen.some((value) => value.kind === entity.kind && value.id === entity.id))];
  const protectedItems = new Map(stored
    .filter((entity) => !entity.deletedAt && entity.kind === "item" && (entity.payload as { system_type?: string | null })?.system_type)
    .map((entity) => [entity.entityId, itemPayloadSchema.parse(entity.payload)]));
  for (const entity of effective) if (entity.kind === "item" && protectedItems.has(entity.id)) {
    assertSystemSyncMutation(protectedItems.get(entity.id)!, entity);
  }

  const finalLive = new Map<string, { kind: string; id: string; data: Record<string, unknown> }>();
  for (const entity of stored) {
    if (!entity.deletedAt && entity.payload) finalLive.set(keyOf(entity), { kind: entity.kind, id: entity.entityId, data: entity.payload as Record<string, unknown> });
  }
  for (const entity of effective) {
    const key = keyOf({ kind: entity.kind, entityId: entity.id });
    if (entity.deleted) finalLive.delete(key);
    else finalLive.set(key, { kind: entity.kind, id: entity.id, data: entity.data as Record<string, unknown> });
  }
  const items = new Map<string, ItemPayload>();
  const systemTypes = new Set<string>();
  for (const entity of finalLive.values()) if (entity.kind === "item") {
    const item = itemPayloadSchema.parse(entity.data);
    assertCanonicalSystemItem(item);
    if (item.system_type && systemTypes.has(item.system_type)) throw new Error(`duplicate system item ${item.system_type}`);
    if (item.system_type) systemTypes.add(item.system_type);
    items.set(entity.id, item);
  }
  for (const entity of effective) {
    if (entity.kind !== "item" || entity.deleted) continue;
    const previousEntity = stored.find((value) => value.kind === "item" && value.entityId === entity.id && !value.deletedAt);
    if (!previousEntity?.payload) continue;
    const previous = itemPayloadSchema.parse(previousEntity.payload);
    const next = items.get(entity.id)!;
    const retainedHistory = [...finalLive.values()].some((value) => (
      (value.kind === "habit_log" || value.kind === "item_exception")
      && (value.data as { item_id?: string }).item_id === entity.id
    ));
    assertItemDefinitionMutation(previous, next, retainedHistory);
  }
  for (const entity of finalLive.values()) {
    if (entity.kind === "habit_log") {
      const log = habitLogPayloadSchema.parse(entity.data), parent = items.get(log.item_id);
      if (!parent) throw new Error(`habit_log ${entity.id}: item_id references missing item ${log.item_id}`);
      if (parent.kind !== "habit" || !recurrenceApplies(parent, log.date)) throw new Error(`habit_log ${entity.id}: parent is not an eligible habit occurrence`);
    }
    if (entity.kind === "item_exception") {
      const exception = itemExceptionPayloadSchema.parse(entity.data), parent = items.get(exception.item_id);
      if (!parent) throw new Error(`item_exception ${entity.id}: item_id references missing item ${exception.item_id}`);
      if (parent.kind !== "event" || !parent.recurrence_frequency || !recurrenceApplies(parent, exception.original_date)) throw new Error(`item_exception ${entity.id}: parent is not an eligible recurring event occurrence`);
    }
  }

  {
    const rank = (entity: LifeFlowSyncEntity) => entity.kind === "item" ? (entity.deleted ? 3 : 0) : (entity.deleted ? 2 : 1);
    for (const entity of [...effective].sort((a, b) => rank(a) - rank(b))) {
      const clientUpdatedAt = new Date(entity.updatedAt);
      const payload = (entity.data ?? {}) as Prisma.InputJsonValue;
      await tx.lifeFlowEntity.upsert({
        where: { userId_kind_entityId: { userId, kind: entity.kind, entityId: entity.id } },
        create: {
          userId,
          kind: entity.kind,
          entityId: entity.id,
          payload: entity.deleted ? undefined : payload,
          deletedAt: entity.deleted ? clientUpdatedAt : null,
          updatedAt: clientUpdatedAt,
        },
        update: {
          payload: entity.deleted ? undefined : payload,
          deletedAt: entity.deleted ? clientUpdatedAt : null,
          updatedAt: clientUpdatedAt,
        },
      });
    }
  }

  if (!snapshot) return [];
  const all = await tx.lifeFlowEntity.findMany({
    where: { userId, kind: { in: [...lifeFlowKinds] } },
    orderBy: [{ kind: "asc" }, { entityId: "asc" }],
  });
  return all.map((entity) => ({
    kind: entity.kind,
    id: entity.entityId,
    updatedAt: entity.updatedAt.toISOString(),
    deleted: entity.deletedAt !== null,
    data: entity.deletedAt ? null : entity.payload,
  }));
}

export async function syncLifeFlow(userId: string, entities: LifeFlowSyncEntity[]) {
  return withLifeFlowTransaction(userId, (tx) => applyLifeFlowMutations(tx, userId, entities));
}
