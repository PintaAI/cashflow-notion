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
import type { SelectColor } from "@notionhq/client/build/src/api-endpoints/common"
import { cn } from "@/lib/utils"

export function CategoryManager() {
  const categoriesQuery = useCategoriesWithDetails()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()
  const updateCategory = useUpdateCategory()
  const [newCategoryName, setNewCategoryName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("More01Icon")
  const [selectedColor, setSelectedColor] = useState("default")
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState("")
  const [editColor, setEditColor] = useState("default")

  const handleCreate = async () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) return

    setError(null)
    try {
      await createCategory.mutateAsync({ name: trimmedName, color: selectedColor, icon: selectedIcon })
      setNewCategoryName("")
      setSelectedIcon("More01Icon")
      setSelectedColor("default")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category")
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
    setError(null)
  }

  const handleUpdate = async () => {
    if (!editingId) return
    const trimmedName = editName.trim()
    if (!trimmedName) return

    setError(null)
    try {
      await updateCategory.mutateAsync({ id: editingId, name: trimmedName, color: editColor, icon: editIcon })
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category")
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
  const SelectedIconComp = categoryIconRegistry[selectedIcon] ?? categoryIconRegistry["More01Icon"]

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

      <div className="space-y-2 rounded-lg border p-3">
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                title="Pick icon"
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
            Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
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
      </div>

      <ScrollArea className="h-[300px] rounded-md border">
        <div className="p-3 space-y-2">
          {categories.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No categories found
            </div>
          ) : (
            categories.map((category) => {
              const isEditing = editingId === category.id
              const config = getCategoryConfig(category.name, category.color as SelectColor, category.icon)
              const EditIconComp = categoryIconRegistry[editIcon] ?? categoryIconRegistry["More01Icon"]

              if (isEditing) {
                return (
                  <div
                    key={category.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-9 text-sm"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-9 shrink-0"
                            title="Pick icon"
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
                    <div className="flex flex-wrap gap-2">
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
                  </div>
                )
              }

              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
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
                        {category.usageCount} entries
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground"
                      onClick={() => startEditing(category)}
                    >
                      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} className="size-4" />
                    </Button>
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
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
