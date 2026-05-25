"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
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
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Tick02Icon,
  Delete02Icon,
  UserGroupIcon,
  Home01Icon,
  TShirtIcon,
  Diamond01Icon,
  Alert01Icon,
  CookieIcon,
  Bus01Icon,
  ShoppingCart01Icon,
  Invoice01Icon,
  GameController01Icon,
  HealthIcon,
  More01Icon,
  MoneyReceiveIcon,
  MoneySendIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

const categoryConfig: Record<CategoryType, { color: string; bgColor: string; icon: typeof UserGroupIcon }> = {
  sosial: { color: "text-pink-700 dark:text-pink-300", bgColor: "bg-pink-100 dark:bg-pink-900/30", icon: UserGroupIcon },
  keluarga: { color: "text-amber-700 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900/30", icon: Home01Icon },
  clothing: { color: "text-violet-700 dark:text-violet-300", bgColor: "bg-violet-100 dark:bg-violet-900/30", icon: TShirtIcon },
  skincare: { color: "text-rose-700 dark:text-rose-300", bgColor: "bg-rose-100 dark:bg-rose-900/30", icon: Diamond01Icon },
  "tidak terduga": { color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-900/30", icon: Alert01Icon },
  Jajan: { color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", icon: CookieIcon },
  Transportasi: { color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-100 dark:bg-blue-900/30", icon: Bus01Icon },
  Belanja: { color: "text-emerald-700 dark:text-emerald-300", bgColor: "bg-emerald-100 dark:bg-emerald-900/30", icon: ShoppingCart01Icon },
  Tagihan: { color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-900/30", icon: Invoice01Icon },
  Hiburan: { color: "text-purple-700 dark:text-purple-300", bgColor: "bg-purple-100 dark:bg-purple-900/30", icon: GameController01Icon },
  Kesehatan: { color: "text-teal-700 dark:text-teal-300", bgColor: "bg-teal-100 dark:bg-teal-900/30", icon: HealthIcon },
  Lainnya: { color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-900/30", icon: More01Icon },
}

const EXPENSE_CATEGORIES: CategoryType[] = [
  "sosial", "keluarga", "clothing", "skincare", "tidak terduga",
  "Jajan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Lainnya",
]

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
  const [category, setCategory] = React.useState<CategoryType | "">(entry.category ?? "")
  const [date, setDate] = React.useState<Date | undefined>(entry.date ? new Date(entry.date) : new Date())
  const [io, setIo] = React.useState<IOType>(entry.io ?? "Expenses")

  React.useEffect(() => {
    if (open) {
      setName(entry.name)
      setNominal(String(entry.nominal))
      setCategory(entry.category ?? "")
      setDate(entry.date ? new Date(entry.date) : new Date())
      setIo(entry.io ?? "Expenses")
    }
  }, [open, entry])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !nominal || (io === "Expenses" && !category)) return

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
    setCategory("")
    setDate(new Date())
    setIo("Expenses")
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh]">
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
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryType)}>
                <SelectTrigger className="h-12 text-base w-full">
                  <SelectValue placeholder="Select category">
                    {category && categoryConfig[category] && (
                      <span className="inline-flex items-center gap-1.5">
                        <HugeiconsIcon icon={categoryConfig[category].icon} strokeWidth={2} className="size-4" />
                        {category}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const config = categoryConfig[cat]
                      return (
                        <SelectItem key={cat} value={cat} className="py-3 text-base">
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
              disabled={isSubmitting || !name.trim() || !nominal || (io === "Expenses" && !category)}
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
