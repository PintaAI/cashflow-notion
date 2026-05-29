"use client"

import * as React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import confetti from "canvas-confetti"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { addEntry, editEntry } from "@/app/actions/cashflow"
import type { CashflowEntry, CategoryType, IOType } from "@/lib/notion"
import { getCategoryConfig } from "@/lib/categories"
import { useCategories } from "@/hooks/use-cashflow-data"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Calendar03Icon,
  CleanIcon,
  Tick02Icon,
  MoneyReceiveIcon,
  MoneySendIcon,
  Camera01Icon,
  Loading03Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CameraCapture } from "@/components/camera-capture"

type CashflowFormDrawerProps = {
  mode: "create" | "edit"
  onSuccess?: () => void
  trigger?: React.ReactNode
  entry?: CashflowEntry
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CashflowFormDrawer({
  mode,
  trigger,
  entry,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  onSuccess,
}: CashflowFormDrawerProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [internalOpen, setInternalOpen] = useState(false)
  const open = mode === "edit" ? (externalOpen ?? false) : internalOpen
  const setOpen = mode === "edit" ? (externalOnOpenChange ?? (() => {})) : setInternalOpen

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [name, setName] = useState("")
  const [nominal, setNominal] = useState("")
  const [category, setCategory] = useState<CategoryType>("Lainnya")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [io, setIo] = useState<IOType>("Expenses")

  const formatNominal = (value: string) => {
    if (!value) return ""
    return `Rp,${Number(value).toLocaleString("id-ID")}`
  }

  const categoriesQuery = useCategories()
  const expenseCategories = categoriesQuery.data ?? []

  const isEdit = mode === "edit"

  React.useEffect(() => {
    if (isEdit && open && entry) {
      setName(entry.name)
      setNominal(String(entry.nominal))
      setCategory(entry.category ?? "Lainnya")
      setDate(entry.date ? new Date(entry.date) : new Date())
      setIo(entry.io ?? "Expenses")
    }
  }, [isEdit, open, entry])

  const celebrateSave = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    navigator.vibrate?.(12)
    confetti({
      particleCount: 70,
      spread: 60,
      startVelocity: 36,
      scalar: 0.85,
      origin: { x: 0.5, y: 0.78 },
    })
  }

  const extractFromImage = async (imageData: string) => {
    setIsExtracting(true)
    try {
      const response = await fetch(imageData)
      const blob = await response.blob()
      const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('image', file)

      const apiResponse = await fetch('/api/extract-receipt', {
        method: 'POST',
        body: formData,
      })

      const result = await apiResponse.json()

      if (result.success && result.data) {
        if (result.data.name) setName(result.data.name)
        if (result.data.amount) setNominal(String(result.data.amount))
        if (result.data.date) {
          const parsedDate = new Date(result.data.date)
          if (!isNaN(parsedDate.getTime())) setDate(parsedDate)
        }
        if (result.data.category && result.data.io !== 'Income') {
          setCategory(result.data.category as CategoryType)
        }
        if (result.data.io) setIo(result.data.io as IOType)
      }
    } catch (error) {
      console.error('Failed to extract receipt data:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleCameraCapture = (imageData: string) => {
    setShowCamera(false)
    extractFromImage(imageData)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsExtracting(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/extract-receipt', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.data) {
        if (result.data.name) setName(result.data.name)
        if (result.data.amount) setNominal(String(result.data.amount))
        if (result.data.date) {
          const parsedDate = new Date(result.data.date)
          if (!isNaN(parsedDate.getTime())) setDate(parsedDate)
        }
        if (result.data.category && result.data.io !== 'Income') {
          setCategory(result.data.category as CategoryType)
        }
        if (result.data.io) setIo(result.data.io as IOType)
      }
    } catch (error) {
      console.error('Failed to extract receipt data:', error)
    } finally {
      setIsExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !nominal) return

    setIsSubmitting(true)
    try {
      if (isEdit && entry) {
        await editEntry(entry.id, {
          name: name.trim(),
          nominal: Number(nominal),
          category: io === "Expenses" ? (category as CategoryType) : undefined,
          date: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : undefined,
          io,
        })
      } else {
        await addEntry({
          name: name.trim(),
          nominal: Number(nominal),
          category: io === "Expenses" ? (category as CategoryType) : undefined,
          date: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : undefined,
          io,
        })
      }

      celebrateSave()
      setName("")
      setNominal("")
      setCategory("Lainnya")
      setDate(new Date())
      setIo("Expenses")
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] })
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error(`Failed to ${isEdit ? "edit" : "add"} entry:`, error)
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
    <Drawer open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DrawerTrigger asChild>
          {trigger || (
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-5" />
              Add Expense
            </Button>
          )}
        </DrawerTrigger>
      )}
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="flex flex-row items-center justify-between pb-2">
          <div className="w-8" />
          <DrawerTitle className="text-lg font-semibold">
            {isEdit ? "Edit Entry" : "Catat Cashflow"}
          </DrawerTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-8 w-8"
          >
            <HugeiconsIcon icon={CleanIcon} strokeWidth={2} className="size-4" />
          </Button>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6 overflow-y-auto">
          {/* I/O Type Toggle */}
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

          {/* Camera Capture Modal - create mode only */}
          {showCamera && !isEdit && (
            <CameraCapture
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
            />
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Description
            </label>
            <Input
              id="name"
              type="text"
              placeholder="What did you spend on?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {["jajan", "parkir", "belanja pasar", "makan siang"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setName(s)}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label htmlFor="nominal" className="text-sm font-medium text-foreground">
              Amount (IDR)
            </label>
            <Input
              id="nominal"
              type="text"
              inputMode="numeric"
              placeholder="Rp,- 0"
              value={formatNominal(nominal)}
              onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
              className="h-12 text-base"
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: 1000, label: "1k", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
                { value: 2000, label: "2k", color: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
                { value: 5000, label: "5k", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
                { value: 10000, label: "10k", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
                { value: 20000, label: "20k", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
                { value: 50000, label: "50k", color: "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200" },
                { value: 100000, label: "100k", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => setNominal(String((Number(nominal) || 0) + btn.value))}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95",
                    btn.color
                  )}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Select - Only for Expenses */}
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
                      const config = getCategoryConfig(cat);
                      return (
                        <SelectItem key={cat} value={cat} className="p-1 text-base">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1", config.bgColor, config.color)}>
                            <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3.5" />
                            {cat}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Picker */}
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
                    year: "numeric"
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

          {/* Bottom Actions */}
          {isEdit ? (
            <div className="pt-4">
              <Button
                type="submit"
                className="h-12 w-full"
                disabled={isSubmitting || !name.trim() || !nominal}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Saving...
                  </span>
                ) : (
                  <>
                    <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-5" />
                    Save
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isExtracting}
              />
              <div className="grid grid-cols-3 gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 gap-2"
                  onClick={() => setShowCamera(true)}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={Camera01Icon} strokeWidth={2} className="size-5" />
                      Camera
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                >
                  <HugeiconsIcon icon={Image01Icon} strokeWidth={2} className="size-5" />
                  Upload
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
                      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-5" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  )
}
