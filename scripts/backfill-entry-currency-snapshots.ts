import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE "Entry"
    SET
      "originalNominal" = COALESCE("originalNominal", "nominal"),
      "originalCurrency" = COALESCE("originalCurrency", 'IDR'),
      "exchangeRateToIdr" = COALESCE("exchangeRateToIdr", 1),
      "exchangeRateAt" = COALESCE("exchangeRateAt", "createdAt")
    WHERE
      "originalNominal" IS NULL
      OR "originalCurrency" IS NULL
      OR "exchangeRateToIdr" IS NULL
      OR "exchangeRateAt" IS NULL
  `;

  console.log(`Backfilled ${result} entries with IDR currency snapshots.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
