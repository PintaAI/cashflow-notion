import "dotenv/config";
import { prisma } from "../lib/db/client";

const oldKinds = ["habit", "habit_log", "time_box", "day_preset", "day_preset_block", "day_preset_schedule"];
const apply = process.argv.includes("--apply");

async function main() {
  const before = await prisma.lifeFlowEntity.groupBy({ by: ["kind"], where: { kind: { in: oldKinds } }, _count: { _all: true }, orderBy: { kind: "asc" } });
  console.table(before.map((row) => ({ kind: row.kind, count: row._count._all })));
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete exactly these old-kind LifeFlowEntity rows.");
    return;
  }
  const result = await prisma.lifeFlowEntity.deleteMany({ where: { kind: { in: oldKinds } } });
  const after = await prisma.lifeFlowEntity.groupBy({ by: ["kind"], where: { kind: { in: oldKinds } }, _count: { _all: true }, orderBy: { kind: "asc" } });
  console.log(`Deleted ${result.count} old LifeFlow rows.`);
  console.table(after.map((row) => ({ kind: row.kind, count: row._count._all })));
}

main().finally(() => prisma.$disconnect());
