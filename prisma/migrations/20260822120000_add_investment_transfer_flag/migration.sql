ALTER TABLE "Entry" ADD COLUMN "isInvestmentTransfer" BOOLEAN NOT NULL DEFAULT false;

-- 1. Built-in feature transfers: "Transfer In" entries living inside INVESTMENT wallets
UPDATE "Entry" e
SET "isInvestmentTransfer" = true
FROM "Category" c
JOIN "Management" m ON m."id" = c."managementId"
WHERE c."id" = e."categoryId"
  AND c."name" = 'Transfer In'
  AND m."category" = 'INVESTMENT'
  AND e."deletedAt" IS NULL;

-- 2. Their paired "Transfer Out" entries in the source wallets, matched by the value
--    signature both sides share (created in one transaction). Default-pattern names
--    must reference the investment wallet to guard against same-day coincidences.
UPDATE "Entry" e
SET "isInvestmentTransfer" = true
FROM "Entry" t
JOIN "Category" tc ON tc."id" = t."categoryId"
JOIN "Management" tm ON tm."id" = t."managementId"
WHERE t."isInvestmentTransfer" = true
  AND tc."name" = 'Transfer In'
  AND e."categoryId" IN (SELECT "id" FROM "Category" WHERE "name" = 'Transfer Out')
  AND t."managementId" <> e."managementId"
  AND t."createdById" IS NOT DISTINCT FROM e."createdById"
  AND t."date" IS NOT DISTINCT FROM e."date"
  AND t."nominal" = e."nominal"
  AND t."originalNominal" IS NOT DISTINCT FROM e."originalNominal"
  AND t."originalCurrency" IS NOT DISTINCT FROM e."originalCurrency"
  AND t."exchangeRateToIdr" IS NOT DISTINCT FROM e."exchangeRateToIdr"
  AND (e."name" = 'Transfer to ' || tm."name" OR e."name" NOT LIKE 'Transfer to %')
  AND e."deletedAt" IS NULL;

-- 3. Mobile-app transfers: entries named "Transfer to <investment wallet>[ · note]"
--    in other wallets (the mobile client records transfers without transfer categories)
UPDATE "Entry" e
SET "isInvestmentTransfer" = true
FROM "Management" x
WHERE x."category" = 'INVESTMENT'
  AND e."managementId" <> x."id"
  AND e."io"::text = 'Expenses'
  AND e."name" ILIKE 'Transfer to ' || x."name" || '%'
  AND e."deletedAt" IS NULL;
