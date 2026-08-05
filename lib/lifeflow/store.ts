import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { lifeFlowKinds, type LifeFlowSyncEntity } from "@/lib/lifeflow/contract";
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

  const finalLive = new Map<string, { kind: string; id: string; data: Record<string, unknown> }>();
  for (const entity of stored) {
    if (!entity.deletedAt && entity.payload) finalLive.set(keyOf(entity), { kind: entity.kind, id: entity.entityId, data: entity.payload as Record<string, unknown> });
  }
  for (const entity of effective) {
    const key = keyOf({ kind: entity.kind, entityId: entity.id });
    if (entity.deleted) finalLive.delete(key);
    else finalLive.set(key, { kind: entity.kind, id: entity.id, data: entity.data as Record<string, unknown> });
  }
  const available = new Map<string, Set<string>>();
  for (const entity of finalLive.values()) available.set(entity.kind, (available.get(entity.kind) ?? new Set()).add(entity.id));
  for (const entity of finalLive.values()) {
    const data = entity.data as Record<string, string | null>;
    const requireParent = (kind: string, parentId: string | null | undefined, field: string) => {
      if (parentId && !available.get(kind)?.has(parentId)) throw new Error(`${entity.kind} ${entity.id}: ${field} references missing ${kind} ${parentId}`);
    };
    if (entity.kind === "habit_log") requireParent("habit", data.habit_id, "habit_id");
    if (entity.kind === "day_preset_block" || entity.kind === "day_preset_schedule") requireParent("day_preset", data.preset_id, "preset_id");
    if (entity.kind === "time_box") requireParent("habit", data.habit_id, "habit_id");
  }

  await prisma.$transaction(async (tx) => {
    for (const entity of effective) {
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
