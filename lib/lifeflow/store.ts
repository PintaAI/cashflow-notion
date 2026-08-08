import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { assertCanonicalSystemItem, assertItemDefinitionMutation, assertSystemSyncMutation, habitLogPayloadSchema, itemExceptionPayloadSchema, itemPayloadSchema, lifeFlowKinds, type ItemPayload, type LifeFlowSyncEntity } from "@/lib/lifeflow/contract";
import { recurrenceApplies } from "@/lib/lifeflow/resolve-day";
import { selectEffectiveLifeFlowMutations } from "@/lib/lifeflow/sync-plan";

export async function assertLifeFlowMembership(userId: string, managementId: string) {
  const membership = await prisma.managementMember.findUnique({
    where: { managementId_userId: { managementId, userId } },
    select: { id: true },
  });
  if (!membership) throw new Error("Management not found");
}

export async function syncLifeFlow(managementId: string, entities: LifeFlowSyncEntity[]) {
  const stored = await prisma.lifeFlowEntity.findMany({
    where: { managementId, kind: { in: [...lifeFlowKinds] } },
    select: { kind: true, entityId: true, payload: true, deletedAt: true, updatedAt: true },
  });
  const keyOf = (entity: { kind: string; entityId: string }) => `${entity.kind}\0${entity.entityId}`;
  const effective = selectEffectiveLifeFlowMutations(stored, entities);
  const protectedItems = new Map(stored.filter((entity) => !entity.deletedAt && entity.kind === "item" && (entity.payload as { system_type?: string | null })?.system_type).map((entity) => [entity.entityId, entity.payload as ItemPayload]));
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
    assertCanonicalSystemItem(managementId, item);
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

  await prisma.$transaction(async (tx) => {
    const rank = (entity: LifeFlowSyncEntity) => entity.kind === "item" ? (entity.deleted ? 3 : 0) : (entity.deleted ? 2 : 1);
    for (const entity of [...effective].sort((a, b) => rank(a) - rank(b))) {
      const clientUpdatedAt = new Date(entity.updatedAt);
      const payload = (entity.data ?? {}) as Prisma.InputJsonValue;
      await tx.lifeFlowEntity.upsert({
        where: { managementId_kind_entityId: { managementId, kind: entity.kind, entityId: entity.id } },
        create: {
          managementId,
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
  });

  const snapshot = await prisma.lifeFlowEntity.findMany({
    where: { managementId, kind: { in: [...lifeFlowKinds] } },
    orderBy: [{ kind: "asc" }, { entityId: "asc" }],
  });
  return snapshot.map((entity) => ({
    kind: entity.kind,
    id: entity.entityId,
    updatedAt: entity.updatedAt.toISOString(),
    deleted: entity.deletedAt !== null,
    data: entity.deletedAt ? null : entity.payload,
  }));
}
