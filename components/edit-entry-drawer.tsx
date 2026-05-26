"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { editEntry } from "@/app/actions/cashflow"
import type { CashflowEntry, CategoryType, IOType } from "@/lib/notion"
import { getCategoryConfig } from "@/lib/categories"
import { useCategories } from "@/hooks/use-cashflow-data"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Tick02Icon,
  Delete02Icon,
  MoneyReceiveIcon,
  MoneySendIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

interface EditEntryDrawerProps {
  entry: CashflowEntry
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditEntryDrawer({ entry, open, onOpenChange, onSuccess }: EditEntryDrawerProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [name, setName] = React.useState(entry.name)
  const [nominal, setNominal] = React.useState(String(entry.nominal))
  const [category, setCategory] = React.useState<CategoryType>(entry.category ?? "Lainnya")
  const [date, setDate] = React.useState<Date | undefined>(entry.date ? new Date(entry.date) : new Date())
  const [io, setIo] = React.useState<IOType>(entry.io ?? "Expenses")
  const categoriesQuery = useCategories()
  const expenseCategories = categoriesQuery.data ?? []

  // Reset form state when drawer opens with new entry - valid pattern for form reset
  React.useEffect(() => {
    if (open) {
      setName(entry.name)
      setNominal(String(entry.nominal))
      setCategory(entry.category ?? "Lainnya")
      setDate(entry.date ? new Date(entry.date) : new Date())
      setIo(entry.io ?? "Expenses")
    }
  }, [open, entry.name, entry.nominal, entry.category, entry.date, entry.io])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !nominal) return

    setIsSubmitting(true)
    try {
      await editEntry(entry.id, {
        name: name.trim(),
        nominal: Number(nominal),
        category: io === "Expenses" ? (category as CategoryType) : undefined,
        date: date?.toISOString().split("T")[0],
        io,
      })
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] })
      onOpenChange(false)
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error("Failed to edit entry:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClear = () => {
    setName("")
    setNominal("")
    setCategory("Lainnya")
    setDate(new Date())
    setIo("Expenses")
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-semibold text-center">
            Edit Entry
          </DrawerTitle>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIo("Income")}
              className={cn(
                "flex items-center justify-center gap-2 py-4 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                io === "Income"
                  ? "bg-green-100 border-green-800 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-transparent border-input text-muted-foreground hover:bg-muted/50"
              )}
            >
              <HugeiconsIcon icon={MoneyReceiveIcon} strokeWidth={2} className="size-5" />
              Income
            </button>
            <button
              type="button"
              onClick={() => setIo("Expenses")}
              className={cn(
                "flex items-center justify-center gap-2 py-4 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                io === "Expenses"
                  ? "bg-red-100 border-red-800 text-red-800 dark:bg-red-900 dark:text-red-200"
                  : "bg-transparent border-input text-muted-foreground hover:bg-muted/50"
              )}
            >
              <HugeiconsIcon icon={MoneySendIcon} strokeWidth={2} className="size-5" />
              Expense
            </button>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-name" className="text-sm font-medium text-foreground">
              Description
            </label>
            <Input
              id="edit-name"
              type="text"
              placeholder="What did you spend on?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-nominal" className="text-sm font-medium text-foreground">
              Amount (IDR)
            </label>
            <Input
              id="edit-nominal"
              type="number"
              placeholder="0"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              className="h-12 text-base"
              min="0"
              required
            />
          </div>

          {io === "Expenses" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 text-base w-full">
                  <SelectValue placeholder="Select category">
                    {category && (
                      <span className="inline-flex items-center gap-1.5">
                        <HugeiconsIcon icon={getCategoryConfig(category).icon} strokeWidth={2} className="size-4" />
                        {category}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <ScrollArea className="h-[200px]">
                    {expenseCategories.map((cat) => {
                      const config = getCategoryConfig(cat)
                      return (
                        <SelectItem key={cat} value={cat} className="p-1 text-base">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1", config.bgColor, config.color)}>
                            <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3.5" />
                            {cat}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-12 w-full justify-start text-base font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} className="size-5 mr-2" />
                  {date ? date.toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }) : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              className="h-12"
              disabled={isSubmitting}
            >
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-5 mr-2" />
              Clear
            </Button>
            <Button
              type="submit"
              className="h-12"
              disabled={isSubmitting || !name.trim() || !nominal}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Saving...
                </span>
              ) : (
                <>
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-5 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
