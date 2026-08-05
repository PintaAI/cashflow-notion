-- RevenueCat was never activated. Remove its unused integration data while
-- preserving cloud sponsor and beta redemption records.
BEGIN;

ALTER TABLE "UserEntitlement" DROP CONSTRAINT "UserEntitlement_userId_fkey";

DROP INDEX "User_revenueCatAppUserId_key";

ALTER TABLE "User" DROP COLUMN "revenueCatAppUserId";

DROP TABLE "RevenueCatDeletionJob";
DROP TABLE "RevenueCatWebhookEvent";
DROP TABLE "UserEntitlement";

COMMIT;
