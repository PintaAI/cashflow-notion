-- LifeFlow is personal user data. Existing wallet-scoped rows are intentionally reset.
DELETE FROM "LifeFlowEntity";

DROP INDEX "LifeFlowEntity_managementId_updatedAt_idx";
DROP INDEX "LifeFlowEntity_managementId_kind_deletedAt_idx";
DROP INDEX "LifeFlowEntity_managementId_kind_entityId_key";
ALTER TABLE "LifeFlowEntity" DROP CONSTRAINT "LifeFlowEntity_managementId_fkey";
ALTER TABLE "LifeFlowEntity" RENAME COLUMN "managementId" TO "userId";

CREATE INDEX "LifeFlowEntity_userId_updatedAt_idx" ON "LifeFlowEntity"("userId", "updatedAt");
CREATE INDEX "LifeFlowEntity_userId_kind_deletedAt_idx" ON "LifeFlowEntity"("userId", "kind", "deletedAt");
CREATE UNIQUE INDEX "LifeFlowEntity_userId_kind_entityId_key" ON "LifeFlowEntity"("userId", "kind", "entityId");
ALTER TABLE "LifeFlowEntity" ADD CONSTRAINT "LifeFlowEntity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
