import {
  CurrencyIcon,
  MoneyExchange03Icon,
  ReceiptDollarIcon,
  TaskDaily01Icon,
  WorkHistoryIcon,
} from "@hugeicons/core-free-icons";

export const cashflowTools = [
  { id: "converter", label: "Cek Krus", icon: CurrencyIcon },
  { id: "transfer", label: "Transfer Dompet", icon: MoneyExchange03Icon },
  { id: "split-bills", label: "Split Bills", icon: ReceiptDollarIcon },
  { id: "lembur", label: "Catat Lemburan", icon: WorkHistoryIcon },
  { id: "habbit-tracker", label: "Habbit Tracker", icon: TaskDaily01Icon },
] as const;

export type CashflowToolId = (typeof cashflowTools)[number]["id"];

export function getCashflowTool(id: string | null | undefined) {
  return cashflowTools.find((tool) => tool.id === id) ?? null;
}
