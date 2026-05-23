"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import { ExpenseFormDrawer } from "@/components/expense-form-drawer"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Analytics01Icon, Add01Icon, Home02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

const navItems = [
  {
    href: "/",
    label: "Home",
    icon: Home02Icon,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: Analytics01Icon,
  },
]

export function MobileBottomNav() {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  if (!isMobile) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid h-16 max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[2rem] border bg-background/90 px-3 shadow-[0_18px_45px_-28px_hsl(var(--foreground))] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition-all duration-200 active:scale-95",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                index === 1 && "col-start-3"
              )}
            >
              <HugeiconsIcon
                icon={item.icon}
                strokeWidth={isActive ? 2.4 : 2}
                className="size-5 transition-transform duration-200 group-hover:-translate-y-0.5"
              />
              <span className="sr-only">{item.label}</span>
              <span
                className={cn(
                  "hidden text-xs tracking-tight min-[380px]:inline",
                  isActive ? "opacity-100" : "opacity-80"
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        <ExpenseFormDrawer
          trigger={
            <button
              type="button"
              aria-label="Add entry"
              className="relative col-start-2 row-start-1 flex size-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_16px_35px_-18px_hsl(var(--primary))] ring-8 ring-background transition-all duration-200 hover:-translate-y-4 hover:shadow-[0_20px_45px_-18px_hsl(var(--primary))] active:-translate-y-2 active:scale-95"
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2.6} className="size-7" />
            </button>
          }
        />
      </div>
    </nav>
  )
}
