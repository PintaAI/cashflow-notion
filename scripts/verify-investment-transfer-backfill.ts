import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [investmentWallets] = await prisma.$queryRaw<{ total: number | bigint }[]>`
    SELECT COUNT(*) AS "total"
    FROM "Management"
    WHERE "category" = 'INVESTMENT'
  `;
  console.log(`INVESTMENT wallets: ${Number(investmentWallets?.total ?? 0)}`);

  const [transferInRows] = await prisma.$queryRaw<{ total: number | bigint }[]>`
    SELECT COUNT(*) AS "total"
    FROM "Entry" e
    JOIN "Category" c ON c."id" = e."categoryId"
    JOIN "Management" m ON m."id" = e."managementId"
    WHERE c."name" = 'Transfer In'
      AND m."category" = 'INVESTMENT'
      AND e."deletedAt" IS NULL
  `;
  console.log(`[1] Transfer In entries inside INVESTMENT wallets: ${Number(transferInRows?.total ?? 0)}`);

  const pairedTransferOut = await prisma.$queryRaw<{ id: string; mgmt: string; date: string | null; nominal: number; name: string }[]>`
    SELECT DISTINCT e."id", m."name" AS mgmt, e."date", e."nominal", e."name"
    FROM "Entry" e
    JOIN "Management" m ON m."id" = e."managementId"
    JOIN "Entry" t
      ON t."date" IS NOT DISTINCT FROM e."date"
      AND t."nominal" = e."nominal"
      AND t."originalNominal" IS NOT DISTINCT FROM e."originalNominal"
      AND t."originalCurrency" IS NOT DISTINCT FROM e."originalCurrency"
      AND t."exchangeRateToIdr" IS NOT DISTINCT FROM e."exchangeRateToIdr"
      AND t."createdById" IS NOT DISTINCT FROM e."createdById"
      AND t."managementId" <> e."managementId"
    JOIN "Category" ec ON ec."id" = e."categoryId"
    JOIN "Category" tc ON tc."id" = t."categoryId"
    JOIN "Management" tm ON tm."id" = t."managementId"
    WHERE ec."name" = 'Transfer Out'
      AND tc."name" = 'Transfer In'
      AND tm."category" = 'INVESTMENT'
      AND (e."name" = 'Transfer to ' || tm."name" OR e."name" NOT LIKE 'Transfer to %')
      AND e."deletedAt" IS NULL
      AND t."deletedAt" IS NULL
  `;
  console.log(`[2] Paired Transfer Out entries: ${pairedTransferOut.length}`);

  const namedTransfers = await prisma.$queryRaw<{ id: string; mgmt: string; date: string | null; nominal: number; name: string }[]>`
    SELECT DISTINCT e."id", m."name" AS mgmt, e."date", e."nominal", e."name"
    FROM "Entry" e
    JOIN "Management" m ON m."id" = e."managementId"
    JOIN "Management" x ON x."category" = 'INVESTMENT'
    WHERE e."managementId" <> x."id"
      AND e."io"::text = 'Expenses'
      AND e."name" ILIKE 'Transfer to ' || x."name" || '%'
      AND e."deletedAt" IS NULL
  `;
  console.log(`[3] Expenses named "Transfer to <investment wallet>": ${namedTransfers.length}`);
  for (const row of namedTransfers) {
    console.log(`    ${row.date} | ${row.mgmt} | ${Math.round(row.nominal).toLocaleString("id-ID")} | ${row.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
