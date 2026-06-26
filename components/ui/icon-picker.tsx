"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Alert01Icon,
  Audit01Icon,
  BookEditIcon,
  Briefcase01Icon,
  Bus01Icon,
  Calendar03Icon,
  Camera01Icon,
  CleanIcon,
  Coffee01Icon,
  CookieIcon,
  CreditCardIcon,
  Diamond01Icon,
  Dumbbell01Icon,
  FavouriteIcon,
  GameController01Icon,
  GiftIcon,
  HealthIcon,
  Home01Icon,
  Image01Icon,
  Invoice01Icon,
  Laundry,
  MoneyReceiveIcon,
  MoneySendIcon,
  More01Icon,
  PinIcon,
  SchoolIcon,
  Share01Icon,
  ShoppingCart01Icon,
  SmartPhone01Icon,
  TShirtIcon,
  UserGroupIcon,
  Wallet01Icon,
  Water,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type NoteIconType = "hugeicon" | "emoji"

export type NoteIconValue = {
  icon: string
  iconType: NoteIconType
  iconColor: string
}

type IconPickerProps = {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
  contentClassName?: string
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  placeholder?: string
}

type NoteIconPickerProps = NoteIconValue & {
  onValueChange: (value: NoteIconValue) => void | Promise<void>
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  align?: React.ComponentProps<typeof PopoverContent>["align"]
}

const searchSvg: IconSvgElement = [
  ["circle", { cx: "10", cy: "10", r: "7", fill: "none", stroke: "currentColor", strokeWidth: "2", key: "0" }],
  ["path", { d: "M15.5 15.5L21 21", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", key: "1" }],
] as const

const iconRegistry: Record<string, IconSvgElement> = {
  Alert01Icon,
  Audit01Icon,
  BookEditIcon,
  Briefcase01Icon,
  Bus01Icon,
  Calendar03Icon,
  Camera01Icon,
  CleanIcon,
  Coffee01Icon,
  CookieIcon,
  CreditCardIcon,
  Diamond01Icon,
  Dumbbell01Icon,
  FavouriteIcon,
  GameController01Icon,
  GiftIcon,
  HealthIcon,
  Home01Icon,
  Image01Icon,
  Invoice01Icon,
  Laundry,
  MoneyReceiveIcon,
  MoneySendIcon,
  More01Icon,
  PinIcon,
  SchoolIcon,
  Share01Icon,
  ShoppingCart01Icon,
  SmartPhone01Icon,
  TShirtIcon,
  UserGroupIcon,
  Wallet01Icon,
  Water,
}

const iconNames = Object.keys(iconRegistry).sort()

const iconColors = [
  { name: "default", label: "Default", swatch: "bg-slate-500", text: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-900/40", ring: "ring-slate-500" },
  { name: "gray", label: "Gray", swatch: "bg-gray-500", text: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-900/40", ring: "ring-gray-500" },
  { name: "brown", label: "Brown", swatch: "bg-amber-700", text: "text-amber-800 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40", ring: "ring-amber-700" },
  { name: "orange", label: "Orange", swatch: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/40", ring: "ring-orange-500" },
  { name: "yellow", label: "Yellow", swatch: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-100 dark:bg-yellow-900/40", ring: "ring-yellow-500" },
  { name: "green", label: "Green", swatch: "bg-green-500", text: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/40", ring: "ring-green-500" },
  { name: "blue", label: "Blue", swatch: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40", ring: "ring-blue-500" },
  { name: "purple", label: "Purple", swatch: "bg-purple-500", text: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/40", ring: "ring-purple-500" },
  { name: "pink", label: "Pink", swatch: "bg-pink-500", text: "text-pink-700 dark:text-pink-300", bg: "bg-pink-100 dark:bg-pink-900/40", ring: "ring-pink-500" },
  { name: "red", label: "Red", swatch: "bg-red-500", text: "text-red-700 dark:text-red-300", bg: "bg-red-100 dark:bg-red-900/40", ring: "ring-red-500" },
]

const emojis = [
  { emoji: "📝", label: "note memo write" },
  { emoji: "📒", label: "notebook" },
  { emoji: "📘", label: "blue book" },
  { emoji: "📚", label: "books library" },
  { emoji: "📌", label: "pin important" },
  { emoji: "⭐", label: "star favorite" },
  { emoji: "🔥", label: "fire hot" },
  { emoji: "💡", label: "idea light" },
  { emoji: "🎯", label: "target goal" },
  { emoji: "✅", label: "check task" },
  { emoji: "💸", label: "money cash expense" },
  { emoji: "💰", label: "money bag saving" },
  { emoji: "🏦", label: "bank finance" },
  { emoji: "🛒", label: "shopping cart" },
  { emoji: "🍔", label: "food burger" },
  { emoji: "☕", label: "coffee drink" },
  { emoji: "🚗", label: "car transport" },
  { emoji: "✈️", label: "travel plane" },
  { emoji: "🏠", label: "home house" },
  { emoji: "💼", label: "work briefcase" },
  { emoji: "🎮", label: "game entertainment" },
  { emoji: "🎵", label: "music" },
  { emoji: "📷", label: "camera photo" },
  { emoji: "🎁", label: "gift present" },
  { emoji: "❤️", label: "heart love" },
  { emoji: "🏃", label: "run fitness" },
  { emoji: "💊", label: "health medicine" },
  { emoji: "🌱", label: "plant growth" },
  { emoji: "🌙", label: "moon night" },
  { emoji: "☀️", label: "sun day" },
  { emoji: "⚡", label: "energy lightning" },
  { emoji: "🧠", label: "brain thinking" },
  { emoji: "🔒", label: "lock private" },
  { emoji: "🧾", label: "receipt bill" },
  { emoji: "📊", label: "chart analytics" },
  { emoji: "🗓️", label: "calendar date" },
]

function getIconColor(color: string) {
  return iconColors.find((item) => item.name === color) ?? iconColors[0]
}

export function HugeiconByName({
  name,
  className,
  strokeWidth = 2,
}: {
  name?: string | null
  className?: string
  strokeWidth?: number
}) {
  const icon = name ? iconRegistry[name] : null

  return <HugeiconsIcon icon={icon ?? More01Icon} strokeWidth={strokeWidth} className={className} />
}

export function NoteIcon({
  icon,
  iconType = "hugeicon",
  iconColor = "default",
  className,
  iconClassName,
}: NoteIconValue & {
  className?: string
  iconClassName?: string
}) {
  const color = getIconColor(iconColor)

  return (
    <span className={cn("inline-flex items-center justify-center rounded-md", color.bg, color.text, className)}>
      {iconType === "emoji" ? (
        <span className={cn("leading-none", iconClassName)}>{icon || "📝"}</span>
      ) : (
        <HugeiconByName name={icon} className={cn("size-4", iconClassName)} />
      )}
    </span>
  )
}

function ColorSwatches({
  value,
  onValueChange,
}: {
  value: string
  onValueChange: (value: string) => void | Promise<void>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {iconColors.map((color) => (
        <button
          key={color.name}
          type="button"
          onClick={() => onValueChange(color.name)}
          className={cn(
            "size-5 rounded-full ring-offset-2 ring-offset-popover transition-transform hover:scale-110",
            color.swatch,
            value === color.name ? cn("ring-2", color.ring) : "ring-1 ring-black/10"
          )}
          aria-label={color.label}
          title={color.label}
        />
      ))}
    </div>
  )
}

export function IconPicker({
  value,
  onValueChange,
  disabled,
  className,
  contentClassName,
  align = "start",
  placeholder = "Cari ikon...",
}: IconPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(query)
  const filteredIcons = iconNames.filter((name) =>
    name.toLowerCase().includes(deferredQuery.trim().toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn("shrink-0", className)}
          disabled={disabled}
          title="Pilih ikon"
        >
          <HugeiconByName name={value} className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("w-72 p-0", contentClassName)}>
        <div className="flex items-center gap-2 border-b px-2 py-2">
          <HugeiconsIcon icon={searchSvg} strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          <div className="grid grid-cols-6 gap-1">
            {filteredIcons.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onValueChange(name)
                  setOpen(false)
                }}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                  value === name && "bg-primary/10 text-primary ring-1 ring-primary"
                )}
                title={name}
                aria-label={name}
              >
                <HugeiconsIcon icon={iconRegistry[name]} strokeWidth={2} className="size-4" />
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">Ikon tidak ditemukan</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function NoteIconPicker({
  icon,
  iconType,
  iconColor,
  onValueChange,
  disabled,
  className,
  triggerClassName,
  contentClassName,
  align = "start",
}: NoteIconPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<NoteIconType>(iconType === "emoji" ? "emoji" : "hugeicon")
  const selectedColor = getIconColor(iconColor)

  function update(next: Partial<NoteIconValue>) {
    return onValueChange({
      icon,
      iconType,
      iconColor,
      ...next,
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-lg outline-none transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            className
          )}
          title="Ubah ikon catatan"
          aria-label="Ubah ikon catatan"
        >
          <NoteIcon
            icon={icon}
            iconType={iconType}
            iconColor={iconColor}
            className={cn("size-9", triggerClassName)}
            iconClassName="size-5 text-base"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className={cn("w-auto overflow-y-auto p-0", contentClassName)}>
        <div className="space-y-2 p-2">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab("hugeicon")}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                tab === "hugeicon" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Icons
            </button>
            <button
              type="button"
              onClick={() => setTab("emoji")}
              className={cn(
                "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                tab === "emoji" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Emoji
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <NoteIcon
                icon={icon}
                iconType={iconType}
                iconColor={iconColor}
                className="size-7"
                iconClassName="size-4 text-sm"
              />
            </div>
            <ColorSwatches value={iconColor} onValueChange={(nextColor) => update({ iconColor: nextColor })} />
          </div>

          <div className="pr-1">
            {tab === "hugeicon" ? (
              <div className="grid grid-cols-6 gap-1">
                {iconNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      void update({ icon: name, iconType: "hugeicon" })
                      setOpen(false)
                    }}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                      iconType === "hugeicon" && icon === name && cn(selectedColor.bg, selectedColor.text, "ring-1", selectedColor.ring)
                    )}
                    title={name}
                    aria-label={name}
                  >
                    <HugeiconsIcon icon={iconRegistry[name]} strokeWidth={2} className="size-4" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {emojis.map((item) => (
                  <button
                    key={`${item.emoji}-${item.label}`}
                    type="button"
                    onClick={() => {
                      void update({ icon: item.emoji, iconType: "emoji" })
                      setOpen(false)
                    }}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                      iconType === "emoji" && icon === item.emoji && cn(selectedColor.bg, "ring-1", selectedColor.ring)
                    )}
                    title={item.label}
                    aria-label={item.label}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
            
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
