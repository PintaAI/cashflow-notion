"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  Loading03Icon,
  PauseIcon,
  PlayIcon,
  Tick02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useRecurringEntries,
  useCreateRecurringEntry,
  useUpdateRecurringEntry,
  useDeleteRecurringEntry,
  useRunRecurringGeneration,
  useCategories,
} from "@/hooks/use-cashflow-data"
import type { RecurringEntryData } from "@/lib/db"
import type { RecurringFrequency, IOType } from "@/lib/db"
import { cn } from "@/lib/utils"

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

function formatCurrency(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`
}

function formatNominalInput(value: string): string {
  const num = Number(value.replace(/[^0-9]/g, ""))
  if (isNaN(num) || num === 0) return ""
  return num.toLocaleString("id-ID")
}

function getFrequencyDetail(entry: RecurringEntryData): string {
  if (entry.frequency === "daily") return "Setiap hari"
  if (entry.frequency === "weekly") return `Setiap ${DAY_NAMES[entry.dayOfWeek ?? 0]}`
  if (entry.frequency === "monthly") return `Tanggal ${entry.dayOfMonth}`
  if (entry.frequency === "yearly") return `${entry.dayOfMonth}/${entry.monthOfYear}`
  return ""
}

function RecurringForm({
  initial,
  onSave,
  onCancel,
  isPending,
  categories,
}: {
  initial?: RecurringEntryData
  onSave: (data: {
    name: string
    nominal: number
    categoryId?: string | null
    io: IOType
    frequency: RecurringFrequency
    dayOfWeek?: number | null
    dayOfMonth?: number | null
    monthOfYear?: number | null
    startDate: string
    endDate?: string | null
  }) => void
  onCancel: () => void
  isPending: boolean
  categories: string[]
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [nominal, setNominal] = useState(initial ? String(Math.round(initial.nominal)) : "")
  const [io, setIo] = useState<IOType>(initial?.io ?? "Expenses")
  const [category, setCategory] = useState(initial?.categoryName ?? "")
  const [frequency, setFrequency] = useState<RecurringFrequency>((initial?.frequency as RecurringFrequency) ?? "monthly")
  const [dayOfWeek, setDayOfWeek] = useState(String(initial?.dayOfWeek ?? "1"))
  const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? "1"))
  const [monthOfYear, setMonthOfYear] = useState(String(initial?.monthOfYear ?? "1"))
  const [startDate, setStartDate] = useState(initial?.startDate ?? new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(initial?.endDate ?? "")

  const handleSubmit = () => {
    if (!name.trim() || !nominal) return
    const numNominal = Number(nominal.replace(/[^0-9]/g, ""))
    if (!numNominal || numNominal <= 0) return

    const selectedCatId = category ? initial?.categoryId ?? null : null

    onSave({
      name: name.trim(),
      nominal: numNominal,
      categoryId: selectedCatId,
      io,
      frequency,
      dayOfWeek: frequency === "weekly" ? Number(dayOfWeek) : null,
      dayOfMonth: frequency === "monthly" || frequency === "yearly" ? Number(dayOfMonth) : null,
      monthOfYear: frequency === "yearly" ? Number(monthOfYear) : null,
      startDate,
      endDate: endDate || null,
    })
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Nama</label>
          <Input
            placeholder="Nama transaksi"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Nominal</label>
          <Input
            placeholder="Rp"
            value={nominal}
            onChange={(e) => setNominal(formatNominalInput(e.target.value))}
            className="h-8 text-xs"
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Tipe</label>
          <Select value={io} onValueChange={(v) => setIo(v as IOType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Expenses">Pengeluaran</SelectItem>
              <SelectItem value="Income">Pemasukan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Kategori</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tanpa kategori" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Frekuensi</label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as RecurringFrequency)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Harian</SelectItem>
              <SelectItem value="weekly">Mingguan</SelectItem>
              <SelectItem value="monthly">Bulanan</SelectItem>
              <SelectItem value="yearly">Tahunan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {frequency === "weekly" && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Hari</label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((day, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(frequency === "monthly" || frequency === "yearly") && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Tanggal</label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)} className="text-xs">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {frequency === "yearly" && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Bulan</label>
            <Select value={monthOfYear} onValueChange={setMonthOfYear}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Mulai</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Berakhir (opsional)</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Batal
        </Button>
        <Button size="xs" onClick={handleSubmit} disabled={isPending || !name.trim() || !nominal}>
          {isPending ? (
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3 animate-spin" />
          ) : (
            <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3" />
          )}
          Simpan
        </Button>
      </div>
    </div>
  )
}

export function RecurringManager() {
  const recurringQuery = useRecurringEntries()
  const createRecurring = useCreateRecurringEntry()
  const updateRecurring = useUpdateRecurringEntry()
  const deleteRecurring = useDeleteRecurringEntry()
  const runGeneration = useRunRecurringGeneration()
  const categoriesQuery = useCategories()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const categories = categoriesQuery.data ?? []
  const entries = recurringQuery.data ?? []

  const handleCreate = async (data: Parameters<typeof createRecurring.mutateAsync>[0]) => {
    setError(null)
    try {
      await createRecurring.mutateAsync(data)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat entri berulang")
    }
  }

  const handleUpdate = async (data: Parameters<typeof updateRecurring.mutateAsync>[0]) => {
    setError(null)
    try {
      await updateRecurring.mutateAsync(data)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui entri berulang")
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    setDeletingId(id)
    try {
      await deleteRecurring.mutateAsync(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus entri berulang")
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await updateRecurring.mutateAsync({ id, active })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status")
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="text-sm text-muted-foreground">
        Atur transaksi yang berulang secara otomatis. Entri akan dibuat sesuai jadwal yang ditentukan.
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4 mr-1" />
            Tambah
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => runGeneration.mutateAsync()}
          disabled={runGeneration.isPending}
        >
          {runGeneration.isPending ? (
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin mr-1" />
          ) : (
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4 mr-1" />
          )}
          Generate
        </Button>
      </div>

      {showForm && (
        <RecurringForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          isPending={createRecurring.isPending}
          categories={categories}
        />
      )}

      {recurringQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : recurringQuery.isError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Gagal memuat entri berulang.
        </div>
      ) : entries.length === 0 && !showForm ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Belum ada entri berulang
        </div>
      ) : (
        <ScrollArea className="h-[200px] sm:h-[300px]">
          <div className="space-y-2">
            {entries.map((entry) => {
              if (editingId === entry.id) {
                return (
                  <RecurringForm
                    key={entry.id}
                    initial={entry}
                    onSave={(data) => handleUpdate({ id: entry.id, ...data })}
                    onCancel={() => setEditingId(null)}
                    isPending={updateRecurring.isPending}
                    categories={categories}
                  />
                )
              }

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                    !entry.active && "opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{entry.name}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full",
                        entry.io === "Income" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {entry.io === "Income" ? "+" : "-"}{formatCurrency(entry.nominal)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {FREQUENCY_LABELS[entry.frequency]} · {getFrequencyDetail(entry)}
                      </span>
                      {entry.categoryName && (
                        <span className="text-[10px] text-muted-foreground">
                          · {entry.categoryName}
                        </span>
                      )}
                      {entry.lastGenerated && (
                        <span className="text-[10px] text-muted-foreground">
                          · terakhir: {entry.lastGenerated}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleToggleActive(entry.id, !entry.active)}
                      title={entry.active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <HugeiconsIcon
                        icon={entry.active ? PauseIcon : PlayIcon}
                        strokeWidth={2}
                        className="size-3.5"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingId(entry.id)}
                    >
                      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                    >
                      {deletingId === entry.id ? (
                        <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3.5 animate-spin" />
                      ) : (
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
