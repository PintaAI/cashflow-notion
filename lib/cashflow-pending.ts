"use client"

import { useSyncExternalStore } from "react"

type PendingSnapshot = {
  count: number
  label: string | null
}

let snapshot: PendingSnapshot = { count: 0, label: null }
const serverSnapshot: PendingSnapshot = { count: 0, label: null }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function beginCashflowPending(label: string) {
  snapshot = { count: snapshot.count + 1, label }
  emit()

  return () => {
    snapshot = {
      count: Math.max(0, snapshot.count - 1),
      label: snapshot.count > 1 ? snapshot.label : null,
    }
    emit()
  }
}

export function useCashflowPending() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
    () => serverSnapshot
  )
}
