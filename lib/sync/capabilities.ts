import { prisma } from "@/lib/db/client";

export async function syncCapabilities() {
  if (process.env.ETHOS_SYNC_V2_ENABLED === "false") return { lifeFlow: 1, metadata: 0 };
  const [state] = await prisma.$queryRaw<{ ready: boolean }[]>`
    SELECT to_regclass('"LifeFlowSyncState"') IS NOT NULL
      AND to_regclass('"LifeFlowChange"') IS NOT NULL
      AND to_regclass('"LifeFlowSyncReceipt"') IS NOT NULL
      AND to_regclass('"WalletSyncRevision"') IS NOT NULL
      AND (SELECT count(*) FROM pg_trigger WHERE tgname IN
        ('ethos_lifeflow_revision', 'ethos_categories_revision', 'ethos_quick_fills_revision', 'ethos_budgets_revision', 'ethos_recurring_revision')
        AND tgenabled IN ('O', 'A') AND NOT tgisinternal) = 5 AS ready`;
  return { lifeFlow: state?.ready ? 2 : 1, metadata: state?.ready ? 1 : 0 };
}
