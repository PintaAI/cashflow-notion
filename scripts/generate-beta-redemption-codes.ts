import { randomBytes, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const CODE_LENGTH = 16;
const prisma = new PrismaClient();

function generateCode(): string {
  return randomBytes(CODE_LENGTH).toString("hex").toUpperCase();
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

async function main() {
  const countArg = process.argv.findIndex((a) => a === "--count");
  const count = countArg >= 0 ? Number.parseInt(process.argv[countArg + 1], 10) : 10;
  const labelArg = process.argv.findIndex((a) => a === "--label");
  const label = labelArg >= 0 ? process.argv[labelArg + 1] : null;
  const expiresArg = process.argv.findIndex((a) => a === "--expires");
  const expiresAt = expiresArg >= 0
    ? new Date(process.argv[expiresArg + 1])
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const apply = process.argv.includes("--apply");

  if (count < 1 || count > 10000) {
    console.error("--count must be between 1 and 10000");
    process.exit(1);
  }

  const codes: { code: string; hash: string }[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    codes.push({ code, hash: hashCode(code) });
  }

  console.log(`Generated ${codes.length} codes (expires: ${expiresAt.toISOString()})`);

  if (apply) {
    await prisma.$transaction(
      codes.map((c) =>
        prisma.betaRedemptionCode.create({
          data: {
            codeHash: c.hash,
            label: label ?? null,
            expiresAt,
          },
        }),
      ),
    );
    console.log(`Inserted ${codes.length} codes into database.`);
  }

  console.log("\n=== DISTRIBUTE THESE CODES SECURELY ===");
  for (const c of codes) {
    console.log(c.code);
  }
}

main()
  .catch((error) => {
    console.error("Code generation failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
