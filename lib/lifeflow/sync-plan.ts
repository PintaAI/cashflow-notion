import type { LifeFlowSyncEntity } from "./contract";

export type ExistingSyncStamp = { kind: string; entityId: string; updatedAt: Date };

const keyOf = (entity: { kind: string; entityId: string }) => `${entity.kind}\0${entity.entityId}`;

export function selectEffectiveLifeFlowMutations(existing: ExistingSyncStamp[], incoming: LifeFlowSyncEntity[]) {
  const existingByKey = new Map(existing.map((entity) => [keyOf(entity), entity]));
  const incomingByKey = new Map<string, LifeFlowSyncEntity>();
  for (const entity of incoming) {
    const key = keyOf({ kind: entity.kind, entityId: entity.id });
    const previous = incomingByKey.get(key);
    if (!previous || new Date(entity.updatedAt).getTime() > new Date(previous.updatedAt).getTime()) incomingByKey.set(key, entity);
  }
  return [...incomingByKey.values()].filter((entity) => {
    const stored = existingByKey.get(keyOf({ kind: entity.kind, entityId: entity.id }));
    return !stored || new Date(entity.updatedAt).getTime() > stored.updatedAt.getTime();
  });
}
