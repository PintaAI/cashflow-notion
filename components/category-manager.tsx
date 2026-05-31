"use client"

import * as React from "react"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  Loading03Icon,
  Tick02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useCategoriesWithDetails,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/use-cashflow-data"
import { getCategoryConfig, CATEGORY_ICON_NAMES, CATEGORY_COLORS, categoryIconRegistry } from "@/lib/categories"
import { cn } from "@/lib/utils"

const colorHexMap: Record<string, string> = {
  default: "#64748b",
  gray: "#6b7280",
  brown: "#d97706",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  red: "#ef4444",
}

function formatBudgetValue(value: string): string {
  const num = Number(value.replace(/[^0-9]/g, ""))
  if (isNaN(num) || num === 0) return ""
  return num.toLocaleString("id-ID")
}

export function CategoryManager() {
  const categoriesQuery = useCategoriesWithDetails()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()
  const updateCategory = useUpdateCategory()
  const [newCategoryName, setNewCategoryName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("More01Icon")
  const [selectedColor, setSelectedColor] = useState("default")
  const [newBudgetDaily, setNewBudgetDaily] = useState("")
  const [newBudgetWeekly, setNewBudgetWeekly] = useState("")
  const [newBudgetMonthly, setNewBudgetMonthly] = useState("")
  const [newBudgetYearly, setNewBudgetYearly] = useState("")
  const [showBudgets, setShowBudgets] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState("")
  const [editColor, setEditColor] = useState("default")
  const [editBudgetDaily, setEditBudgetDaily] = useState("")
  const [editBudgetWeekly, setEditBudgetWeekly] = useState("")
  const [editBudgetMonthly, setEditBudgetMonthly] = useState("")
  const [editBudgetYearly, setEditBudgetYearly] = useState("")
  const [isNameFocused, setIsNameFocused] = useState(false)
  const [isEditFocused, setIsEditFocused] = useState(false)

  const handleCreate = async () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) return

    setError(null)
    try {
      await createCategory.mutateAsync({
        name: trimmedName,
        color: selectedColor,
        icon: selectedIcon,
        budgets: {
          budgetDaily: newBudgetDaily ? Number(newBudgetDaily.replace(/[^0-9]/g, "")) : null,
          budgetWeekly: newBudgetWeekly ? Number(newBudgetWeekly.replace(/[^0-9]/g, "")) : null,
          budgetMonthly: newBudgetMonthly ? Number(newBudgetMonthly.replace(/[^0-9]/g, "")) : null,
          budgetYearly: newBudgetYearly ? Number(newBudgetYearly.replace(/[^0-9]/g, "")) : null,
        },
      })
      setNewCategoryName("")
      setSelectedIcon("More01Icon")
      setSelectedColor("default")
      setNewBudgetDaily("")
      setNewBudgetWeekly("")
      setNewBudgetMonthly("")
      setNewBudgetYearly("")
      setShowBudgets(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat kategori")
    }
  }

  const startEditing = (category: typeof categories[number]) => {
    if (editingId === category.id) {
      setEditingId(null)
      return
    }
    setEditingId(category.id)
    setEditName(category.name)
    setEditIcon(category.icon ?? "More01Icon")
    setEditColor(category.color ?? "default")
    setEditBudgetDaily(category.budgetDaily != null ? String(category.budgetDaily) : "")
    setEditBudgetWeekly(category.budgetWeekly != null ? String(category.budgetWeekly) : "")
    setEditBudgetMonthly(category.budgetMonthly != null ? String(category.budgetMonthly) : "")
    setEditBudgetYearly(category.budgetYearly != null ? String(category.budgetYearly) : "")
    setError(null)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    const trimmedName = editName.trim()
    if (!trimmedName) return

    setError(null)
    try {
      await updateCategory.mutateAsync({
        id: editingId,
        name: trimmedName,
        color: editColor,
        icon: editIcon,
        budgetDaily: editBudgetDaily ? Number(editBudgetDaily.replace(/[^0-9]/g, "")) : null,
        budgetWeekly: editBudgetWeekly ? Number(editBudgetWeekly.replace(/[^0-9]/g, "")) : null,
        budgetMonthly: editBudgetMonthly ? Number(editBudgetMonthly.replace(/[^0-9]/g, "")) : null,
        budgetYearly: editBudgetYearly ? Number(editBudgetYearly.replace(/[^0-9]/g, "")) : null,
      })
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui kategori")
    }
  }

  const handleDelete = async (categoryId: string, categoryName: string, usageCount: number) => {
    if (usageCount > 0) {
      setError(`Tidak dapat menghapus "${categoryName}" - memiliki ${usageCount} entri`)
      return
    }

    setError(null)
    setDeletingId(categoryId)
    try {
      const result = await deleteCategory.mutateAsync(categoryId)
      if (!result.success && result.usageCount) {
        setError(`Tidak dapat menghapus "${categoryName}" - memiliki ${result.usageCount} entri`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus kategori")
    } finally {
      setDeletingId(null)
    }
  }

  if (categoriesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (categoriesQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Gagal memuat kategori. Silakan coba lagi.
      </div>
    )
  }

  const categories = categoriesQuery.data ?? []
  const SelectedIconComp = categoryIconRegistry[selectedIcon] ?? categoryIconRegistry["More01Icon"]

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="text-sm text-muted-foreground">
        Kelola kategori pengeluaran. Kategori yang memiliki entri tidak dapat dihapus.
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Nama kategori baru"
            value={newCategoryName}
            onChange={(e) => {
              setNewCategoryName(e.target.value)
              setError(null)
            }}
            className="flex-1"
            disabled={createCategory.isPending}
            onFocus={() => setIsNameFocused(true)}
            onBlur={() => setIsNameFocused(false)}
            style={{ "--ring": colorHexMap[selectedColor] ?? colorHexMap.default } as React.CSSProperties}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
          
                title="Pilih ikon"
              >
                <HugeiconsIcon icon={SelectedIconComp} strokeWidth={2} className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <ScrollArea className="h-48">
                <div className="flex flex-wrap gap-1 p-2">
                  {CATEGORY_ICON_NAMES.map((name) => {
                    const Icon = categoryIconRegistry[name]
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { setSelectedIcon(name) }}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                          selectedIcon === name && "bg-primary/10 text-primary ring-1 ring-primary"
                        )}
                        title={name}
                      >
                        <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4" />
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button
            onClick={handleCreate}
            disabled={!newCategoryName.trim() || createCategory.isPending}
            size="sm"
          >
            {createCategory.isPending ? (
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            )}
            Tambah
          </Button>
        </div>

        {isNameFocused && (
        <div className="flex flex-wrap gap-2 justify-center" onMouseDown={(e) => e.preventDefault()}>
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setSelectedColor(c.name)}
              className={cn(
                "size-6 rounded-full transition-all",
                c.swatch,
                selectedColor === c.name ? "ring-2 ring-offset-1 ring-offset-background scale-110" : "ring-1 ring-inset ring-black/10"
              )}
              title={c.name}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowBudgets(!showBudgets)}
        >
          <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-3.5" />
          Budget {showBudgets ? "▲" : "▼"}
        </button>
        {showBudgets && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Harian</label>
              <Input
                placeholder="Rp"
                value={newBudgetDaily}
                onChange={(e) => setNewBudgetDaily(formatBudgetValue(e.target.value))}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Mingguan</label>
              <Input
                placeholder="Rp"
                value={newBudgetWeekly}
                onChange={(e) => setNewBudgetWeekly(formatBudgetValue(e.target.value))}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Bulanan</label>
              <Input
                placeholder="Rp"
                value={newBudgetMonthly}
                onChange={(e) => setNewBudgetMonthly(formatBudgetValue(e.target.value))}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Tahunan</label>
              <Input
                placeholder="Rp"
                value={newBudgetYearly}
                onChange={(e) => setNewBudgetYearly(formatBudgetValue(e.target.value))}
                className="h-8 text-xs"
                inputMode="numeric"
              />
            </div>
          </div>
        )}
      </div>
    </div>

      <ScrollArea className="h-[200px] sm:h-[300px]">
        <div className="space-y-1">
          {categories.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada kategori
            </div>
          ) : (
            categories.map((category) => {
              const isEditing = editingId === category.id
              const config = getCategoryConfig(category.name, category.color as string, category.icon)
              const EditIconComp = categoryIconRegistry[editIcon] ?? categoryIconRegistry["More01Icon"]

              if (isEditing) {
                return (
                  <div
                    key={category.id}
                    className="rounded-lg border bg-card p-2 space-y-2"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-9 text-sm"
                        onFocus={() => setIsEditFocused(true)}
                        onBlur={() => setIsEditFocused(false)}
                        style={{ "--ring": colorHexMap[editColor] ?? colorHexMap.default } as React.CSSProperties}
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-9 shrink-0"
                            title="Pilih ikon"
                          >
                            <HugeiconsIcon icon={EditIconComp} strokeWidth={2} className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-0">
                          <ScrollArea className="h-48">
                            <div className="flex flex-wrap gap-1 p-2">
                              {CATEGORY_ICON_NAMES.map((name) => {
                                const Icon = categoryIconRegistry[name]
                                return (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => { setEditIcon(name) }}
                                    className={cn(
                                      "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                                      editIcon === name && "bg-primary/10 text-primary ring-1 ring-primary"
                                    )}
                                    title={name}
                                  >
                                    <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-4" />
                                  </button>
                                )
                              })}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="icon"
                        className="size-9 shrink-0"
                        onClick={handleUpdate}
                        disabled={!editName.trim() || updateCategory.isPending}
                      >
                        {updateCategory.isPending ? (
                          <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                        ) : (
                          <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-4" />
                        )}
                      </Button>
                    </div>
                    {isEditFocused && (
                    <div className="flex flex-wrap gap-2 justify-center" onMouseDown={(e) => e.preventDefault()}>
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setEditColor(c.name)}
                          className={cn(
                            "size-5 rounded-full transition-all",
                            c.swatch,
                            editColor === c.name ? "ring-2 ring-offset-1 ring-offset-background scale-110" : "ring-1 ring-inset ring-black/10"
                          )}
                          title={c.name}
                        />
                      ))}
                    </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Budget Harian</label>
                        <Input
                          placeholder="Rp"
                          value={editBudgetDaily}
                          onChange={(e) => setEditBudgetDaily(formatBudgetValue(e.target.value))}
                          className="h-8 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Budget Mingguan</label>
                        <Input
                          placeholder="Rp"
                          value={editBudgetWeekly}
                          onChange={(e) => setEditBudgetWeekly(formatBudgetValue(e.target.value))}
                          className="h-8 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Budget Bulanan</label>
                        <Input
                          placeholder="Rp"
                          value={editBudgetMonthly}
                          onChange={(e) => setEditBudgetMonthly(formatBudgetValue(e.target.value))}
                          className="h-8 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Budget Tahunan</label>
                        <Input
                          placeholder="Rp"
                          value={editBudgetYearly}
                          onChange={(e) => setEditBudgetYearly(formatBudgetValue(e.target.value))}
                          className="h-8 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 min-w-0 text-left"
                    onClick={() => startEditing(category)}
                  >
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1", config.bgColor, config.color)}>
                      <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3" />
                      <span className="text-sm font-medium">{category.name}</span>
                    </span>
                    {category.usageCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {category.usageCount} entri
                      </span>
                    )}
                    {(category.budgetDaily || category.budgetWeekly || category.budgetMonthly || category.budgetYearly) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-2.5" />
                        {category.budgetYearly ? `Rp ${Math.round(category.budgetYearly / 1_000_000)}jt/thn` : category.budgetMonthly ? `Rp ${Math.round(category.budgetMonthly / 1000)}k/bln` : category.budgetWeekly ? `Rp ${Math.round(category.budgetWeekly / 1000)}k/mgg` : `Rp ${Math.round(category.budgetDaily! / 1000)}k/hr`}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => startEditing(category)}
                    >
                      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(category.id, category.name, category.usageCount)}
                      disabled={deletingId === category.id || category.usageCount > 0}
                    >
                      {deletingId === category.id ? (
                        <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3.5 animate-spin" />
                      ) : (
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
