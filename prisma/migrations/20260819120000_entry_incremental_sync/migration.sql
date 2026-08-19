ALTER TABLE "Entry" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Entry_managementId_updatedAt_id_idx"
ON "Entry"("managementId", "updatedAt", "id");

CREATE INDEX "Entry_managementId_date_createdAt_id_idx"
ON "Entry"("managementId", "date", "createdAt", "id");

CREATE TABLE "EntrySyncMutation" (
  "id" TEXT NOT NULL,
  "managementId" TEXT NOT NULL,
  "mutationId" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntrySyncMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntrySyncMutation_managementId_mutationId_key"
ON "EntrySyncMutation"("managementId", "mutationId");

CREATE INDEX "EntrySyncMutation_createdAt_idx" ON "EntrySyncMutation"("createdAt");
