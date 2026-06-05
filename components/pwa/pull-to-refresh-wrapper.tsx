"use client"

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh"
import { PullToRefreshIndicator } from "@/components/pwa"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { cashflowQueryKeys } from "@/hooks/use-cashflow-data"

interface PullToRefreshWrapperProps {
  children: React.ReactNode
}

export function PullToRefreshWrapper({ children }: PullToRefreshWrapperProps) {
  const router = useRouter()
  const params = useParams<{ managementId?: string }>()
  const queryClient = useQueryClient()
  const { containerRef, isRefreshing, pullDistance, handlers } = usePullToRefresh({
    onRefresh: async () => {
      if (params.managementId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries(params.managementId) }),
          queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary(params.managementId) }),
          queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.activity(params.managementId) }),
          queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot(params.managementId) }),
        ])
      }
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
