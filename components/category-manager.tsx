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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useCategoriesWithDetails,
  useCreateCategory,
  useDeleteCategory,
} from "@/hooks/use-cashflow-data"
import { getCategoryConfig } from "@/lib/categories"
import type { SelectColor } from "@notionhq/client/build/src/api-endpoints/common"
import { cn } from "@/lib/utils"

export function CategoryManager() {
  const categoriesQuery = useCategoriesWithDetails()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()
  const [newCategoryName, setNewCategoryName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) return

    setError(null)
    try {
      await createCategory.mutateAsync(trimmedName)
      setNewCategoryName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category")
    }
  }

  const handleDelete = async (categoryId: string, categoryName: string, usageCount: number) => {
    if (usageCount > 0) {
      setError(`Cannot delete "${categoryName}" - it has ${usageCount} entries`)
      return
    }

    setError(null)
    setDeletingId(categoryId)
    try {
      const result = await deleteCategory.mutateAsync(categoryId)
      if (!result.success && result.usageCount) {
        setError(`Cannot delete "${categoryName}" - it has ${result.usageCount} entries`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category")
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
        Failed to load categories. Please try again.
      </div>
    )
  }

  const categories = categoriesQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Manage expense categories. Categories with entries cannot be deleted.
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="New category name"
          value={newCategoryName}
          onChange={(e) => {
            setNewCategoryName(e.target.value)
            setError(null)
          }}
          className="flex-1"
          disabled={createCategory.isPending}
        />
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
          Add
        </Button>
      </div>

      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-3 space-y-2">
          {categories.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No categories found
            </div>
          ) : (
            categories.map((category) => {
              const config = getCategoryConfig(category.name, category.color as SelectColor)
              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1", config.bgColor, config.color)}>
                      <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3" />
                      <span className="text-sm font-medium">{category.name}</span>
                    </span>
                    {category.usageCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {category.usageCount} entries
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(category.id, category.name, category.usageCount)}
                    disabled={deletingId === category.id || category.usageCount > 0}
                  >
                    {deletingId === category.id ? (
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