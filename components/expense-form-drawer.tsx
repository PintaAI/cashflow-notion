"use client"

import * as React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose
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
import { addEntry } from "@/app/actions/cashflow"
import type { CategoryType, IOType } from "@/lib/notion"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Calendar03Icon,
  Delete02Icon,
  Tick02Icon,
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
  Camera01Icon,
  Loading03Icon,
  Image01Icon
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CameraCapture } from "@/components/camera-capture"

// Category configuration with colors and icons (same as cashflow-table)
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
};

const EXPENSE_CATEGORIES: CategoryType[] = [
  "sosial",
  "keluarga",
  "clothing",
  "skincare",
  "tidak terduga",
  "Jajan",
  "Transportasi",
  "Belanja",
  "Tagihan",
  "Hiburan",
  "Kesehatan",
  "Lainnya"
]

interface ExpenseFormDrawerProps {
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function ExpenseFormDrawer({ trigger, onSuccess }: ExpenseFormDrawerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [name, setName] = useState("")
  const [nominal, setNominal] = useState("")
  const [category, setCategory] = useState<CategoryType | "">("")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [io, setIo] = useState<IOType>("Expenses")

  const extractFromImage = async (imageData: string) => {
    setIsExtracting(true)
    try {
      // Convert base64 data URL to blob for FormData
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
        // Fill in the name/description
        if (result.data.name) {
          setName(result.data.name)
        }
        // Fill in the amount
        if (result.data.amount) {
          setNominal(String(result.data.amount))
        }
        // Fill in the date
        if (result.data.date) {
          const parsedDate = new Date(result.data.date)
          if (!isNaN(parsedDate.getTime())) {
            setDate(parsedDate)
          }
        }
        // Fill in the category (only for expenses)
        if (result.data.category && result.data.io !== 'Income') {
          setCategory(result.data.category as CategoryType)
        }
        // Set the I/O type
        if (result.data.io) {
          setIo(result.data.io as IOType)
        }
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
        // Fill in the name/description
        if (result.data.name) {
          setName(result.data.name)
        }
        // Fill in the amount
        if (result.data.amount) {
          setNominal(String(result.data.amount))
        }
        // Fill in the date
        if (result.data.date) {
          const parsedDate = new Date(result.data.date)
          if (!isNaN(parsedDate.getTime())) {
            setDate(parsedDate)
          }
        }
        // Fill in the category (only for expenses)
        if (result.data.category && result.data.io !== 'Income') {
          setCategory(result.data.category as CategoryType)
        }
        // Set the I/O type
        if (result.data.io) {
          setIo(result.data.io as IOType)
        }
      }
    } catch (error) {
      console.error('Failed to extract receipt data:', error)
    } finally {
      setIsExtracting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Category is required only for Expenses
    if (!name.trim() || !nominal || (io === "Expenses" && !category)) return

    setIsSubmitting(true)
    
    try {
      await addEntry({
        name: name.trim(),
        nominal: Number(nominal),
        category: io === "Expenses" ? (category as CategoryType) : undefined,
        date: date?.toISOString().split('T')[0],
        io,
      })
      
      // Reset form
      setName("")
      setNominal("")
      setCategory("")
      setDate(new Date())
      setIo("Expenses")
      
      // Close drawer
      setOpen(false)
      
      // Refresh data
      router.refresh()
      onSuccess?.()
    } catch (error) {
      console.error("Failed to add entry:", error)
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
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || (
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-5" />
            Add Expense
          </Button>
        )}
      </DrawerTrigger>
      <DrawerContent className="max-h-[96vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-semibold text-center">
            Add New Entry
          </DrawerTitle>
        </DrawerHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6 overflow-y-auto">
          {/* I/O Type Toggle - Large touch targets */}
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

          {/* Scan Receipt Buttons */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isExtracting}
            />
            <div className="grid grid-cols-2 gap-2">
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
            </div>
          </div>

          {/* Camera Capture Modal */}
          {showCamera && (
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
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label htmlFor="nominal" className="text-sm font-medium text-foreground">
              Amount (IDR)
            </label>
            <Input
              id="nominal"
              type="number"
              placeholder="0"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              className="h-12 text-base"
              min="0"
              required
            />
            {/* Quick Amount Buttons - IDR currency note colors */}
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
                      const config = categoryConfig[cat];
                      return (
                        <SelectItem key={cat} value={cat} className="py-3 text-base">
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

          {/* Action Buttons */}
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