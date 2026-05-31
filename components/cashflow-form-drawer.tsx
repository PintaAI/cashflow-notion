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
import type { CashflowEntry, CategoryType, IOType } from "@/lib/db"
import { getCategoryConfig } from "@/lib/categories"
import { useCategories, useCategoriesWithDetails, useQuickFills } from "@/hooks/use-cashflow-data"
import { HugeiconsIcon } from "@hugeicons/react"
import {
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
  const isEdit = mode === "edit"

  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen ?? internalOpen
  const setOpen = externalOnOpenChange ?? setInternalOpen

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [name, setName] = useState(() => isEdit ? (entry?.name ?? "") : "")
  const [nominal, setNominal] = useState(() => isEdit && entry ? String(entry.nominal) : "")
  const [category, setCategory] = useState<CategoryType>(() => isEdit ? (entry?.category ?? "") : "")
  const [date, setDate] = useState<Date | undefined>(() => isEdit && entry?.date ? new Date(entry.date) : new Date())
  const [io, setIo] = useState<IOType>(() => isEdit ? (entry?.io ?? "Expenses") : "Expenses")

  const formatNominal = (value: string) => {
    if (!value) return ""
    return `Rp,${Number(value).toLocaleString("id-ID")}`
  }

  const categoriesQuery = useCategoriesWithDetails()
  const expenseCategories = categoriesQuery.data ?? []
  const quickFillsQuery = useQuickFills()
  const quickFills = quickFillsQuery.data ?? []

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
          category: category || undefined,
          date: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : undefined,
          io,
        })
      } else {
        await addEntry({
          name: name.trim(),
          nominal: Number(nominal),
          category: category || undefined,
          date: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : undefined,
          io,
        })
      }

      celebrateSave()
      setName("")
      setNominal("")
    setCategory("")
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
      {!isEdit && trigger && (
        <DrawerTrigger asChild>
          {trigger}
        </DrawerTrigger>
      )}
      <DrawerContent className="mx-auto max-h-[90vh] max-w-md data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <DrawerHeader className="flex flex-row items-center justify-between pb-2">
          <div className="w-8" />
          <DrawerTitle className="text-lg font-semibold">
            {isEdit ? "Edit Catatan" : "Tambah Catatan"}
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
              spending apa hari ini?
            </label>
            <Input
              id="name"
              type="text"
              placeholder="jajan, parkir, dll"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 text-base"
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {quickFills.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setName(preset.name)
                    setNominal(String(preset.nominal))
                    if (preset.category) setCategory(preset.category)
                  }}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label htmlFor="nominal" className="text-sm font-medium text-foreground">
              Total
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

          {/* Category Select */}
          {(
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 text-base w-full">
                  <SelectValue placeholder="Select category">
                    {category && (() => {
                      const catData = expenseCategories.find((c) => c.name === category)
                      const config = catData ? getCategoryConfig(catData.name, catData.color as any, catData.icon) : getCategoryConfig(category)
                      return (
                        <span className="inline-flex items-center gap-1.5">
                          <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-4" />
                          {category}
                        </span>
                      )
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <ScrollArea className="h-[200px]">
                    {expenseCategories.map((cat) => {
                      const config = getCategoryConfig(cat.name, cat.color as any, cat.icon);
                      return (
                        <SelectItem key={cat.id} value={cat.name} className="p-1 text-base">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1", config.bgColor, config.color)}>
                            <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3.5" />
                            {cat.name}
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
