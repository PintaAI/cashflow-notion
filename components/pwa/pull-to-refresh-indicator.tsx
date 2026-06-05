"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  threshold: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1)
  const showIndicator = pullDistance > 0 || isRefreshing

  if (!showIndicator) return null

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-4 transition-all duration-200",
        "bg-gradient-to-b from-background/80 to-transparent"
      )}
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
        opacity: progress,
      }}
    >
      <div className={cn(
        "flex items-center justify-center size-10 rounded-full",
        "bg-muted/80 backdrop-blur-sm shadow-sm"
      )}>
        {isRefreshing ? (
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            className="size-5 animate-spin text-primary"
          />
        ) : (
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={cn(
              "size-5 text-muted-foreground transition-transform duration-200",
              progress >= 1 && "rotate-180 text-primary"
            )}
          />
        )}
      </div>
    </div>
  )
}
