"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { CashflowFormDrawer } from "@/components/cashflow-form-drawer"
import { motion, useReducedMotion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import { Analytics01Icon, Add01Icon, File01Icon, Home02Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export type AppTab = "home" | "summary" | "setting" | "catatan"

const navItems = [
  {
    value: "home" as const,
    label: "Home",
    icon: Home02Icon,
  },
  {
    value: "catatan" as const,
    label: "Catatan",
    icon: File01Icon,
  },
  {
    value: "summary" as const,
    label: "Summary",
    icon: Analytics01Icon,
  },
  {
    value: "setting" as const,
    label: "Setting",
    icon: UserCircleIcon,
  },
]

interface MobileBottomNavProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const isMobile = useIsMobile()
  const shouldReduceMotion = useReducedMotion()

  if (!isMobile) return null

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.7 }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="relative mx-auto max-w-sm">
        <motion.div
          initial={shouldReduceMotion ? false : { y: 28, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={transition}
          className="mx-auto grid h-[4.5rem] max-w-sm grid-cols-5 items-center gap-0.5 rounded-[2rem] border bg-background/90 px-2 shadow-[0_18px_55px_-24px_hsl(var(--foreground)),0_8px_24px_-18px_hsl(var(--primary))] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75"
        >
          {navItems.slice(0, 2).map((item) => {
            const isActive = activeTab === item.value

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onTabChange(item.value)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-14 min-w-0 flex-col items-center justify-center gap-px overflow-hidden rounded-full px-2 py-1 text-xs font-medium transition-colors duration-200 active:scale-95",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-bottom-nav-active"
                    className="absolute inset-0 rounded-full bg-primary/10"
                    transition={transition}
                  />
                )}
                <HugeiconsIcon
                  icon={item.icon}
                  strokeWidth={isActive ? 2.4 : 2}
                  className="relative z-10 size-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
                />
                <span
                  className={cn(
                    "relative z-10 text-[10px] leading-none",
                    isActive ? "opacity-100" : "opacity-80"
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}

          <CashflowFormDrawer mode="create"
            trigger={
              <motion.button
                type="button"
                aria-label="Add entry"
                whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                transition={transition}
                className="-mt-6 flex size-14 items-center justify-center justify-self-center rounded-full bg-primary text-primary-foreground shadow-lg ring-6 ring-background/90 border-2 border-primary/20 transition-shadow duration-200 hover:shadow-xl hover:border-primary/40"
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2.6} className="size-5.5" />
              </motion.button>
            }
          />

          {navItems.slice(2).map((item) => {
            const isActive = activeTab === item.value

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onTabChange(item.value)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-14 min-w-0 flex-col items-center justify-center gap-px overflow-hidden rounded-full px-2 py-1 text-xs font-medium transition-colors duration-200 active:scale-95",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-bottom-nav-active"
                    className="absolute inset-0 rounded-full bg-primary/10"
                    transition={transition}
                  />
                )}
                <HugeiconsIcon
                  icon={item.icon}
                  strokeWidth={isActive ? 2.4 : 2}
                  className="relative z-10 size-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
                />
                <span
                  className={cn(
                    "relative z-10 text-[10px] leading-none",
                    isActive ? "opacity-100" : "opacity-80"
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </motion.div>
      </div>
    </nav>
  )
}
