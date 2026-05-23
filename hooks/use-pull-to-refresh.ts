"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"

interface UsePullToRefreshOptions {
  onRefresh?: () => void | Promise<void>
  threshold?: number
}

export function usePullToRefresh(options: UsePullToRefreshOptions = {}) {
  const { onRefresh, threshold = 80 } = options
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when at the top of the page
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0 || isRefreshing) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current

    // Only allow pulling down (positive diff)
    if (diff > 0 && window.scrollY === 0) {
      // Apply resistance to make it feel natural
      const resistance = 0.5
      const newPullDistance = Math.min(diff * resistance, threshold * 1.5)
      setPullDistance(newPullDistance)
    }
  }, [isRefreshing, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(threshold)

      try {
        if (onRefresh) {
          await onRefresh()
        } else {
          router.refresh()
        }
      } catch (error) {
        console.error("Refresh failed:", error)
      }

      // Reset after animation
      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 500)
    } else {
      setPullDistance(0)
    }

    startY.current = 0
  }, [pullDistance, threshold, isRefreshing, onRefresh, router])

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}