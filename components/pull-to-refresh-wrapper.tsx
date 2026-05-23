"use client"

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator"
import { useRouter } from "next/navigation"

interface PullToRefreshWrapperProps {
  children: React.ReactNode
}

export function PullToRefreshWrapper({ children }: PullToRefreshWrapperProps) {
  const router = useRouter()
  const { containerRef, isRefreshing, pullDistance, handlers } = usePullToRefresh({
    onRefresh: () => router.refresh(),
    threshold: 80,
  })

  return (
    <div
      ref={containerRef}
      {...handlers}
      className="min-h-screen touch-pan-y"
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={80}
      />
      {children}
    </div>
  )
}