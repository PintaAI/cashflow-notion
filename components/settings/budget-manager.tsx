"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useBudgetStatus, useSaveOverallBudget, useRemoveOverallBudget } from "@/hooks/use-cashflow-data"
import type { BudgetPeriod, BudgetStatusItem } from "@/lib/db"
import { cn } from "@/lib/utils"
import { useCurrency } from "@/components/providers/currency-provider"

function formatCurrency(value: number, format: (amountIdr: number, opts?: { compact?: boolean }) => string): string {
  return format(value, { compact: true })
}

function formatBudgetValue(value: string): string {
  const num = Number(value.replace(/[^0-9]/g, ""))
  if (isNaN(num) || num === 0) return ""
  return num.toLocaleString()
}

function ProgressBar({ percentage, isWarning, isOverBudget }: { percentage: number; isWarning: boolean; isOverBudget: boolean }) {
  const clamped = Math.min(percentage, 100)
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          isOverBudget ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function OverallBudgetRow({
  period,
  label,
  status,
}: {
  period: BudgetPeriod
  label: string
  status: BudgetStatusItem | undefined
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [amount, setAmount] = useState("")
  const saveBudget = useSaveOverallBudget()
  const removeBudget = useRemoveOverallBudget()
  const { format, toIdr, toDisplay, option } = useCurrency()

  const startEdit = () => {
    setAmount(status ? String(Math.round(toDisplay(status.budgetAmount))) : "")
    setIsEditing(true)
  }

  const handleSave = async () => {
    const num = Number(amount.replace(/[^0-9]/g, ""))
    if (!num || num <= 0) return
    await saveBudget.mutateAsync({ period, amount: Math.round(toIdr(num)) })
    setIsEditing(false)
  }

  const handleRemove = async () => {
    await removeBudget.mutateAsync(period)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-sm font-medium w-20 shrink-0">{label}</span>
        <Input
          placeholder={option.symbol}
          value={amount}
          onChange={(e) => setAmount(formatBudgetValue(e.target.value))}
          className="h-8 text-xs flex-1"
          inputMode="numeric"
          autoFocus
        />
        <Button size="xs" onClick={handleSave} disabled={saveBudget.isPending}>
          {saveBudget.isPending ? <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3 animate-spin" /> : "Simpan"}
        </Button>
        {status && (
          <Button variant="ghost" size="xs" className="text-destructive" onClick={handleRemove} disabled={removeBudget.isPending}>
            Hapus
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={() => setIsEditing(false)}>
          Batal
        </Button>
      </div>
    )
  }

  return (
    <div className="py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {status ? (
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-medium",
              status.isOverBudget ? "text-red-500" : status.isWarning ? "text-yellow-600" : "text-muted-foreground"
            )}>
              {status.percentage}%
            </span>
            <Button variant="ghost" size="xs" className="h-6 px-2 text-xs" onClick={startEdit}>
              Edit
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="xs" className="h-6 px-2 text-xs text-muted-foreground" onClick={startEdit}>
            + Atur
          </Button>
        )}
      </div>
      {status && (
        <>
          <ProgressBar percentage={status.percentage} isWarning={status.isWarning} isOverBudget={status.isOverBudget} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{formatCurrency(status.spent, format)} / {formatCurrency(status.budgetAmount, format)}</span>
            <span>sisa {formatCurrency(status.remaining, format)}</span>
          </div>
        </>
      )}
    </div>
  )
}

export function BudgetManager() {
  const budgetStatusQuery = useBudgetStatus()
  const allStatuses = budgetStatusQuery.data ?? []
  const { format } = useCurrency()

  const getStatus = (period: BudgetPeriod) =>
    allStatuses.find((s) => s.type === "overall" && s.period === period)

  const hasAnyWarning = allStatuses.some((s) => s.isWarning || s.isOverBudget)

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="text-sm text-muted-foreground">
        Atur budget total pengeluaran per periode. Budget per kategori bisa diatur di menu Kategori.
      </div>

      {hasAnyWarning && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-1">
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Budget Warning</p>
          {allStatuses
            .filter((s) => s.isWarning || s.isOverBudget)
            .map((s) => (
              <p key={`${s.type}-${s.id}-${s.period}`} className="text-[11px] text-yellow-700/80 dark:text-yellow-400/80">
                {s.type === "overall" ? "Total" : s.name} ({s.period}): {s.percentage}% — {formatCurrency(s.spent, format)} / {formatCurrency(s.budgetAmount, format)}
              </p>
            ))}
        </div>
      )}

      {budgetStatusQuery.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-3.5" />
              Overall Budget
            </div>
          </div>
          <div className="px-3">
            <OverallBudgetRow period="daily" label="Harian" status={getStatus("daily")} />
          </div>
          <div className="px-3">
            <OverallBudgetRow period="weekly" label="Mingguan" status={getStatus("weekly")} />
          </div>
          <div className="px-3">
            <OverallBudgetRow period="monthly" label="Bulanan" status={getStatus("monthly")} />
          </div>
          <div className="px-3">
            <OverallBudgetRow period="yearly" label="Tahunan" status={getStatus("yearly")} />
          </div>
        </div>
      )}
    </div>
  )
}
