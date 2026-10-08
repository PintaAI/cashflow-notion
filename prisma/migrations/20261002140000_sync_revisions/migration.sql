BEGIN;
-- Additive metadata only. Keep change history/receipts until an explicit,
-- epoch-changing compaction protocol is implemented.
CREATE TABLE "LifeFlowSyncState" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  epoch TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  revision BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE "LifeFlowChange" (
  "userId" TEXT NOT NULL REFERENCES "LifeFlowSyncState"("userId") ON DELETE CASCADE,
  revision BIGINT NOT NULL,
  kind TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  payload JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  PRIMARY KEY ("userId", revision)
);
CREATE INDEX "LifeFlowChange_entity_idx" ON "LifeFlowChange"("userId", kind, "entityId", revision DESC);
CREATE TABLE "LifeFlowSyncReceipt" (
  "userId" TEXT NOT NULL REFERENCES "LifeFlowSyncState"("userId") ON DELETE CASCADE,
  "mutationId" TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result JSONB NOT NULL,
  PRIMARY KEY ("userId", "mutationId")
);
CREATE TABLE "WalletSyncRevision" (
  "managementId" TEXT PRIMARY KEY REFERENCES "Management"(id) ON DELETE CASCADE,
  epoch TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  categories BIGINT NOT NULL DEFAULT 0,
  "quickFills" BIGINT NOT NULL DEFAULT 0,
  budgets BIGINT NOT NULL DEFAULT 0,
  recurring BIGINT NOT NULL DEFAULT 0
);

CREATE FUNCTION ethos_record_lifeflow_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_value "LifeFlowEntity"; next_revision BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_OP = 'DELETE' THEN row_value := OLD; ELSE row_value := NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = row_value."userId") THEN RETURN NULL; END IF;
  INSERT INTO "LifeFlowSyncState"("userId") VALUES (row_value."userId") ON CONFLICT DO NOTHING;
  -- The row lock is held through commit: another writer cannot allocate a
  -- revision ahead of an earlier uncommitted change for the same user.
  UPDATE "LifeFlowSyncState" SET revision = revision + 1 WHERE "userId" = row_value."userId" RETURNING revision INTO next_revision;
  INSERT INTO "LifeFlowChange" VALUES (row_value."userId", next_revision, row_value.kind, row_value."entityId",
    row_value.payload, CASE WHEN TG_OP = 'DELETE' THEN clock_timestamp() ELSE row_value."updatedAt" END,
    CASE WHEN TG_OP = 'DELETE' THEN clock_timestamp() ELSE row_value."deletedAt" END);
  RETURN NULL;
END $$;
CREATE TRIGGER ethos_lifeflow_revision AFTER INSERT OR UPDATE OR DELETE ON "LifeFlowEntity"
  FOR EACH ROW EXECUTE FUNCTION ethos_record_lifeflow_change();

-- Lock and backfill a consistent baseline before capability can be advertised.
LOCK TABLE "LifeFlowEntity" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "LifeFlowSyncState"("userId") SELECT DISTINCT "userId" FROM "LifeFlowEntity" ON CONFLICT DO NOTHING;
INSERT INTO "LifeFlowChange"("userId", revision, kind, "entityId", payload, "updatedAt", "deletedAt")
SELECT "userId", row_number() OVER (PARTITION BY "userId" ORDER BY CASE WHEN kind = 'item' THEN 0 ELSE 1 END, kind, "entityId"), kind, "entityId", payload, "updatedAt", "deletedAt" FROM "LifeFlowEntity";
UPDATE "LifeFlowSyncState" state SET revision = source.revision
FROM (SELECT "userId", max(revision) revision FROM "LifeFlowChange" GROUP BY "userId") source WHERE state."userId" = source."userId";

CREATE FUNCTION ethos_record_wallet_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wallet TEXT; previous_wallet TEXT; area TEXT := TG_ARGV[0];
BEGIN
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_OP <> 'INSERT' THEN previous_wallet := OLD."managementId"; END IF;
  IF TG_OP <> 'DELETE' THEN wallet := NEW."managementId"; END IF;
  FOR wallet IN SELECT DISTINCT id FROM unnest(ARRAY[wallet, previous_wallet]) id WHERE id IS NOT NULL ORDER BY id LOOP
    IF EXISTS (SELECT 1 FROM "Management" WHERE id = wallet) THEN
      INSERT INTO "WalletSyncRevision"("managementId") VALUES (wallet) ON CONFLICT DO NOTHING;
      EXECUTE format('UPDATE "WalletSyncRevision" SET %I = %I + 1 WHERE "managementId" = $1', area, area) USING wallet;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER ethos_categories_revision AFTER INSERT OR UPDATE OR DELETE ON "Category" FOR EACH ROW EXECUTE FUNCTION ethos_record_wallet_revision('categories');
CREATE TRIGGER ethos_quick_fills_revision AFTER INSERT OR UPDATE OR DELETE ON "QuickFill" FOR EACH ROW EXECUTE FUNCTION ethos_record_wallet_revision('quickFills');
CREATE TRIGGER ethos_budgets_revision AFTER INSERT OR UPDATE OR DELETE ON "OverallBudget" FOR EACH ROW EXECUTE FUNCTION ethos_record_wallet_revision('budgets');
CREATE TRIGGER ethos_recurring_revision AFTER INSERT OR UPDATE OR DELETE ON "RecurringEntry" FOR EACH ROW EXECUTE FUNCTION ethos_record_wallet_revision('recurring');
INSERT INTO "WalletSyncRevision"("managementId") SELECT id FROM "Management" ON CONFLICT DO NOTHING;
CREATE INDEX "LifeFlowEntity_parent_sync_idx" ON "LifeFlowEntity" ("userId", (payload->>'item_id')) WHERE kind IN ('habit_log', 'item_exception');
COMMIT;
