"use client"

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { PullToRefreshIndicator } from "@/components/pull-to-refresh-indicator"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { cashflowQueryKeys } from "@/hooks/use-cashflow-data"

interface PullToRefreshWrapperProps {
  children: React.ReactNode
}

export function PullToRefreshWrapper({ children }: PullToRefreshWrapperProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { containerRef, isRefreshing, pullDistance, handlers } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries }),
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary }),
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.activity }),
        queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot }),
      ])
      router.refresh()
    },
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
