"use client"

import * as React from "react"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  Loading03Icon,
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
  useQuickFills,
  useCreateQuickFill,
  useDeleteQuickFill,
  useCategoriesWithDetails,
} from "@/hooks/use-cashflow-data"
import { getCategoryConfig } from "@/lib/categories"
import { cn } from "@/lib/utils"

export function QuickFillManager() {
  const quickFillsQuery = useQuickFills()
  const categoriesQuery = useCategoriesWithDetails()
  const createQuickFill = useCreateQuickFill()
  const deleteQuickFill = useDeleteQuickFill()

  const [name, setName] = useState("")
  const [nominal, setNominal] = useState("")
  const [categoryId, setCategoryId] = useState<string>("none")
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || !nominal) return

    setError(null)
    try {
      await createQuickFill.mutateAsync({
        name: trimmedName,
        nominal: Number(nominal),
        categoryId: categoryId === "none" ? null : categoryId,
      })
      setName("")
      setNominal("")
      setCategoryId("none")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quick fill")
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    setDeletingId(id)
    try {
      await deleteQuickFill.mutateAsync(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete quick fill")
    } finally {
      setDeletingId(null)
    }
  }

  if (quickFillsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (quickFillsQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load quick fills. Please try again.
      </div>
    )
  }

  const presets = quickFillsQuery.data ?? []
  const categories = categoriesQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        One-tap buttons that fill the name, amount, and category when creating an entry.
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex gap-2">
          <Input
            placeholder="Name (e.g. jajan)"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null) }}
            className="flex-1"
            disabled={createQuickFill.isPending}
          />
          <Input
            placeholder="Amount"
            type="text"
            inputMode="numeric"
            value={nominal}
            onChange={(e) => { setNominal(e.target.value.replace(/\D/g, "")); setError(null) }}
            className="w-28"
            disabled={createQuickFill.isPending}
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="flex-1 h-10 text-sm">
              <SelectValue placeholder="Category (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((cat) => {
                const config = getCategoryConfig(cat.name, cat.color as any, cat.icon)
                return (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5", config.bgColor, config.color)}>
                      <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3" />
                      {cat.name}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !nominal || createQuickFill.isPending}
            size="sm"
          >
            {createQuickFill.isPending ? (
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
            )}
            Add
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[250px] rounded-md border">
        <div className="p-3 space-y-2">
          {presets.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No quick fills yet
            </div>
          ) : (
            presets.map((preset) => {
              const catData = preset.categoryId ? categories.find((c) => c.id === preset.categoryId) : null
              const config = preset.category ? getCategoryConfig(preset.category, catData?.color as any, catData?.icon) : null
              return (
                <div
                  key={preset.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium truncate">{preset.name}</span>
                    <span className="text-sm text-muted-foreground shrink-0">
                      Rp {preset.nominal.toLocaleString("id-ID")}
                    </span>
                    {config && (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 shrink-0", config.bgColor, config.color)}>
                        <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-2.5" />
                        <span className="text-xs">{preset.category}</span>
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(preset.id)}
                    disabled={deletingId === preset.id}
                  >
                    {deletingId === preset.id ? (
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
