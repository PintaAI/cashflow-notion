import { PrismaClient } from "@prisma/client";

import { DEFAULT_CATEGORIES } from "../lib/default-categories";

const prisma = new PrismaClient();

const defaultNames = new Set<string>(DEFAULT_CATEGORIES.map((c) => c.name));
const shouldApply = process.argv.includes("--apply");

async function main() {
  const managements = await prisma.management.findMany({ select: { id: true, name: true } });
  let removed = 0;
  let skipped = 0;
  let candidates = 0;

  console.log(`Found ${managements.length} management(s)`);
  console.log(shouldApply ? "Mode: apply" : "Mode: dry-run. Pass --apply to delete categories.");

  for (const m of managements) {
    const categories = await prisma.category.findMany({
      where: { managementId: m.id },
      select: { id: true, name: true },
    });

    const toRemove = categories.filter((c) => !defaultNames.has(c.name));
    candidates += toRemove.length;
    if (toRemove.length > 0) {
      console.log(`Management "${m.name}" has ${toRemove.length} old categor${toRemove.length === 1 ? "y" : "ies"}`);
    }

    for (const cat of toRemove) {
      const [entryCount, quickFillCount, recurringCount] = await Promise.all([
        prisma.entry.count({ where: { categoryId: cat.id } }),
        prisma.quickFill.count({ where: { categoryId: cat.id } }),
        prisma.recurringEntry.count({ where: { categoryId: cat.id } }),
      ]);
      if (entryCount + quickFillCount + recurringCount > 0) {
        skipped += 1;
        console.log(`  Skip "${cat.name}" - still in use (${entryCount} entries, ${quickFillCount} quick fills, ${recurringCount} recurring)`);
        continue;
      }

      if (shouldApply) {
        await prisma.category.delete({ where: { id: cat.id } });
        console.log(`  Removed "${cat.name}"`);
      } else {
        console.log(`  Would remove "${cat.name}"`);
      }
      removed += 1;
    }
  }

  console.log(`Cleanup complete. Candidates: ${candidates}, ${shouldApply ? "removed" : "would remove"}: ${removed}, skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
