import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query"
import type { CashflowEntry } from "@/lib/notion"

type EntriesPage = {
  entries: CashflowEntry[]
  nextCursor: string | null
  hasMore: boolean
}

type EntriesData = InfiniteData<EntriesPage, string | null>

type EntriesSnapshot = Array<{
  queryKey: QueryKey
  data: EntriesData | undefined
}>

function shouldIncludeEntry(queryKey: QueryKey, entry: CashflowEntry) {
  const ioFilter = queryKey[1]

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

export function snapshotCashflowEntries(queryClient: QueryClient): EntriesSnapshot {
  return queryClient.getQueriesData<EntriesData>({ queryKey: ["cashflow-entries"] })
    .map(([queryKey, data]) => ({ queryKey, data }))
}

export function restoreCashflowEntries(queryClient: QueryClient, snapshot: EntriesSnapshot) {
  for (const { queryKey, data } of snapshot) {
    queryClient.setQueryData(queryKey, data)
  }
}

export function addEntryToCashflowCache(queryClient: QueryClient, entry: CashflowEntry) {
  for (const [queryKey, data] of queryClient.getQueriesData<EntriesData>({ queryKey: ["cashflow-entries"] })) {
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

export function updateEntryInCashflowCache(queryClient: QueryClient, entry: CashflowEntry) {
  for (const [queryKey, data] of queryClient.getQueriesData<EntriesData>({ queryKey: ["cashflow-entries"] })) {
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
  entry: CashflowEntry
) {
  queryClient.setQueriesData<EntriesData>(
    { queryKey: ["cashflow-entries"] },
    (data) => mapEntry(data, (current) => current.id === entryId, () => entry)
  )
}

export function removeEntriesFromCashflowCache(queryClient: QueryClient, entryIds: string[]) {
  const entryIdSet = new Set(entryIds)

  queryClient.setQueriesData<EntriesData>(
    { queryKey: ["cashflow-entries"] },
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
