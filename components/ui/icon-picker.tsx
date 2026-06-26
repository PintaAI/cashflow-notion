"use client"

import * as React from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const fallbackIcon: IconSvgElement = [
  ["circle", { cx: "12", cy: "5", r: "1.5", fill: "currentColor", key: "0" }],
  ["circle", { cx: "12", cy: "12", r: "1.5", fill: "currentColor", key: "1" }],
  ["circle", { cx: "12", cy: "19", r: "1.5", fill: "currentColor", key: "2" }],
] as const

const searchSvg: IconSvgElement = [
  ["circle", { cx: "10", cy: "10", r: "7", fill: "none", stroke: "currentColor", strokeWidth: "2", key: "0" }],
  ["path", { d: "M15.5 15.5L21 21", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", key: "1" }],
] as const

type IconPage = {
  items: string[]
  icons?: Record<string, IconSvgElement>
  total: number
  hasMore: boolean
}

type IconResponse = {
  icons?: Record<string, IconSvgElement>
}

type IconPickerProps = {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
  contentClassName?: string
  align?: React.ComponentProps<typeof PopoverContent>["align"]
  pageSize?: number
  placeholder?: string
}

const loadedIcons = new Map<string, IconSvgElement>()

async function loadHugeicon(name: string) {
  const cachedIcon = loadedIcons.get(name)
  if (cachedIcon) return cachedIcon

  try {
    const response = await fetch(`/api/icons/hugeicons?names=${encodeURIComponent(name)}`)
    if (!response.ok) throw new Error("Failed to load icon")

    const data = (await response.json()) as IconResponse
    const icon = data.icons?.[name]
    if (!icon) throw new Error("Icon not found")

    loadedIcons.set(name, icon)
    return icon
  } catch {
    loadedIcons.set(name, fallbackIcon)
    return fallbackIcon
  }
}

function LazyHugeicon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: string
  className?: string
  strokeWidth?: number
}) {
  const [icon, setIcon] = React.useState<IconSvgElement>(
    () => loadedIcons.get(name) ?? fallbackIcon
  )

  React.useEffect(() => {
    let isActive = true

    loadHugeicon(name)
      .then((nextIcon) => {
        if (isActive) setIcon(nextIcon)
      })
      .catch(() => {
        if (isActive) setIcon(fallbackIcon)
      })

    return () => {
      isActive = false
    }
  }, [name])

  return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} className={className} />
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
  return (
    <LazyHugeicon
      name={name ?? "More01Icon"}
      className={className}
      strokeWidth={strokeWidth}
    />
  )
}

export function IconPicker({
  value,
  onValueChange,
  disabled,
  className,
  contentClassName,
  align = "start",
  pageSize = 72,
  placeholder = "Cari ikon...",
}: IconPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(query)
  const [items, setItems] = React.useState<string[]>([])
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestRef = React.useRef(0)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const viewportRef = React.useRef<HTMLDivElement | null>(null)

  const loadPage = React.useCallback(
    async (nextOffset: number, mode: "replace" | "append") => {
      const requestId = ++requestRef.current
      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          offset: String(nextOffset),
          limit: String(pageSize),
        })
        if (deferredQuery) params.set("q", deferredQuery)

        const response = await fetch(`/api/icons/hugeicons?${params.toString()}`)
        if (!response.ok) throw new Error("Failed to load icons")

        const data = (await response.json()) as IconPage
        if (requestId !== requestRef.current) return

        Object.entries(data.icons ?? {}).forEach(([name, icon]) => {
          loadedIcons.set(name, icon)
        })

        setItems((currentItems) =>
          mode === "replace"
            ? data.items
            : Array.from(new Set([...currentItems, ...data.items]))
        )
        setHasMore(data.hasMore)
      } catch {
        if (requestId === requestRef.current) {
          setError("Gagal memuat ikon")
          setHasMore(false)
        }
      } finally {
        if (requestId === requestRef.current) setIsLoading(false)
      }
    },
    [deferredQuery, pageSize]
  )

  React.useEffect(() => {
    if (!open) return
    void Promise.resolve().then(() => loadPage(0, "replace"))
  }, [deferredQuery, loadPage, open])

  React.useEffect(() => {
    if (!open || !hasMore || isLoading) return

    const sentinel = sentinelRef.current
    const viewport = viewportRef.current
    if (!sentinel || !viewport) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadPage(items.length, "append")
        }
      },
      { root: viewport, rootMargin: "96px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, items.length, loadPage, open])

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
        <div ref={viewportRef} className="max-h-64 overflow-y-auto p-2">
          <div className="grid grid-cols-6 gap-1">
            {items.map((name) => (
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
                <LazyHugeicon name={name} className="size-4" />
              </button>
            ))}
          </div>
          <div ref={sentinelRef} className="h-8" />
          {isLoading && (
            <div className="py-2 text-center text-xs text-muted-foreground">Memuat ikon...</div>
          )}
          {error && <div className="py-2 text-center text-xs text-destructive">{error}</div>}
          {!isLoading && !error && items.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">Ikon tidak ditemukan</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
