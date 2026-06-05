import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query"
import type { CashflowEntry } from "@/lib/db"

type EntriesPage = {
  entries: CashflowEntry[]
  nextCursor: string | null
  hasMore: boolean
}

type EntriesData = InfiniteData<EntriesPage, number>

type EntriesSnapshot = Array<{
  queryKey: QueryKey
  data: EntriesData | undefined
}>

function shouldIncludeEntry(queryKey: QueryKey, entry: CashflowEntry) {
  const ioFilter = queryKey[3]

  return ioFilter === undefined || ioFilter === "all" || ioFilter === entry.io
}

function mapEntry(
  data: EntriesData | undefined,
  matcher: (entry: CashflowEntry) => boolean,
  updater: (entry: CashflowEntry) => CashflowEntry
) {
  if (!data) return data

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      entries: page.entries.map((entry) => (matcher(entry) ? updater(entry) : entry)),
    })),
  }
}

function entriesQueryKey(managementId: string) {
  return ["management", managementId, "cashflow-entries"]
}

export function snapshotCashflowEntries(queryClient: QueryClient, managementId: string): EntriesSnapshot {
  return queryClient.getQueriesData<EntriesData>({ queryKey: entriesQueryKey(managementId) })
    .map(([queryKey, data]) => ({ queryKey, data }))
}

export function restoreCashflowEntries(queryClient: QueryClient, snapshot: EntriesSnapshot) {
  for (const { queryKey, data } of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

export function addEntryToCashflowCache(queryClient: QueryClient, entry: CashflowEntry, managementId: string) {
  for (const [queryKey, data] of queryClient.getQueriesData<EntriesData>({ queryKey: entriesQueryKey(managementId) })) {
    if (!data || !shouldIncludeEntry(queryKey, entry)) continue

    queryClient.setQueryData<EntriesData>(queryKey, {
      ...data,
      pages: data.pages.map((page, index) => ({
        ...page,
        entries: index === 0
          ? [entry, ...page.entries.filter((current) => current.id !== entry.id)]
          : page.entries.filter((current) => current.id !== entry.id),
      })),
    })
  }
}

export function updateEntryInCashflowCache(queryClient: QueryClient, entry: CashflowEntry, managementId: string) {
  for (const [queryKey, data] of queryClient.getQueriesData<EntriesData>({ queryKey: entriesQueryKey(managementId) })) {
    if (!data) continue

    let found = false
    const nextPages = data.pages.map((page) => {
      const entries = page.entries.flatMap((current) => {
        if (current.id !== entry.id) return [current]

        found = true
        return shouldIncludeEntry(queryKey, entry) ? [entry] : []
      })

      return { ...page, entries }
    })

    if (!found && shouldIncludeEntry(queryKey, entry) && nextPages[0]) {
      nextPages[0] = {
        ...nextPages[0],
        entries: [entry, ...nextPages[0].entries],
      }
    }

    queryClient.setQueryData<EntriesData>(queryKey, {
      ...data,
      pages: nextPages,
    })
  }
}

export function replaceEntryInCashflowCache(
  queryClient: QueryClient,
  entryId: string,
  entry: CashflowEntry,
  managementId: string
) {
  queryClient.setQueriesData<EntriesData>(
    { queryKey: entriesQueryKey(managementId) },
    (data) => mapEntry(data, (current) => current.id === entryId, () => entry)
  )
}

export function removeEntriesFromCashflowCache(queryClient: QueryClient, entryIds: string[], managementId: string) {
  const entryIdSet = new Set(entryIds)

  queryClient.setQueriesData<EntriesData>(
    { queryKey: entriesQueryKey(managementId) },
    (data) => {
      if (!data) return data

      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          entries: page.entries.filter((entry) => !entryIdSet.has(entry.id)),
        })),
      }
    }
  )
}
