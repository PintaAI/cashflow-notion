import {
  CurrencyIcon,
  MoneyExchange03Icon,
  ReceiptDollarIcon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";

export const cashflowTools = [
  { id: "converter", label: "Convert Duit", icon: CurrencyIcon },
  { id: "transfer", label: "Transfer Dompet", icon: MoneyExchange03Icon },
  { id: "split-bills", label: "Split Bills", icon: ReceiptDollarIcon },
  { id: "lembur", label: "Lembur Tracker", icon: WorkHistoryIcon },
] as const;

export type CashflowToolId = (typeof cashflowTools)[number]["id"];

export function getCashflowTool(id: string | null | undefined) {
  return cashflowTools.find((tool) => tool.id === id) ?? null;
}
