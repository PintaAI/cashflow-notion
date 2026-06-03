"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useInfiniteQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  File01Icon,
  HeadingIcon,
  Money01Icon,
  Tag01Icon,
  Calendar01Icon,
  ArrowUpDownIcon,
  Delete03Icon,
  Loading03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CashflowTableSkeleton } from "@/components/loading-skeletons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CashflowEntry, IOType, CategoryType } from "@/lib/db";
import { getCategoryConfig } from "@/lib/categories";
import { fetchEntriesFiltered, removeEntry, editEntry } from "@/app/actions/cashflow";
import { CashflowFormDrawer } from "@/components/cashflow-form-drawer";
import { UserAvatar, getUserDisplayName } from "@/components/user-avatar";
import { useQueryClient } from "@tanstack/react-query";
import {
  removeEntriesFromCashflowCache,
  restoreCashflowEntries,
  snapshotCashflowEntries,
  updateEntryInCashflowCache,
} from "@/lib/cashflow-query-cache";
import { beginCashflowPending, useCashflowPending } from "@/lib/cashflow-pending";
import { cashflowQueryKeys, useCategories, useManagementMembers } from "@/hooks/use-cashflow-data";
import { useCurrency } from "@/components/providers/currency-provider";

function getColumns(deps: {
  format: (amountIdr: number, opts?: { compact?: boolean }) => string;
  memberOptions: Array<{ id: string; role: string; user: { id: string; name: string | null; email: string; image: string | null } }>;
  queryClient: ReturnType<typeof useQueryClient>;
}): ColumnDef<CashflowEntry>[] {
  const { format, memberOptions, queryClient } = deps;
  return [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected()}
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <button
        className="flex w-full items-center gap-1.5 text-left hover:text-foreground transition-colors cursor-pointer select-none max-w-[200px]"
        onClick={column.getToggleSortingHandler()}
        title={
          column.getIsSorted() === "asc"
            ? "Sorted ascending"
            : column.getIsSorted() === "desc"
              ? "Sorted descending"
              : "Click to sort"
        }
      >
        <HugeiconsIcon icon={HeadingIcon} size={16} className="text-muted-foreground shrink-0" />
        <span className="truncate">Judul</span>
        {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : null}
      </button>
    ),
    cell: ({ row }) => <div className="font-medium truncate max-w-[200px]">{row.getValue("name")}</div>,
  },
  {
    accessorKey: "nominal",
    header: ({ column }) => (
      <button
        className="flex w-full items-center justify-end gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={column.getToggleSortingHandler()}
        title={
          column.getIsSorted() === "asc"
            ? "Sorted ascending"
            : column.getIsSorted() === "desc"
              ? "Sorted descending"
              : "Click to sort"
        }
      >
        <HugeiconsIcon icon={Money01Icon} size={16} className="text-muted-foreground shrink-0" />
        <span>Nominal</span>
        {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : null}
      </button>
    ),
    cell: ({ row }) => {
      const amount = row.getValue("nominal") as number;
      const io = row.getValue("io") as IOType | null;
      const isIncome = io === "Income";

      return (
        <div className={`text-right font-medium ${isIncome ? "text-green-600 dark:text-green-400" : "text-red-900 dark:text-red-500"}`}>
          {format(amount, { compact: true })}
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <button
        className="flex w-full items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={column.getToggleSortingHandler()}
        title={
          column.getIsSorted() === "asc"
            ? "Sorted ascending"
            : column.getIsSorted() === "desc"
              ? "Sorted descending"
              : "Click to sort"
        }
      >
        <HugeiconsIcon icon={Tag01Icon} size={16} className="text-muted-foreground shrink-0" />
        <span>Category</span>
        {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : null}
      </button>
    ),
    cell: ({ row }) => {
      const category = row.getValue("category") as CategoryType | null;
      if (!category) return <span className="text-muted-foreground">-</span>;
      
      const config = getCategoryConfig(category);
      return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${config.bgColor} ${config.color}`}>
          <HugeiconsIcon icon={config.icon} strokeWidth={2} className="size-3" />
          {category}
        </span>
      );
    },
    filterFn: (row, id, value) => {
      return value === "all" || row.getValue(id) === value;
    },
  },
  {
    accessorKey: "createdBy",
    header: () => (
      <div className="flex items-center gap-1.5 text-left">
        <HugeiconsIcon icon={UserCircleIcon} size={16} className="text-muted-foreground shrink-0" />
        <span className="truncate">Ditambah oleh</span>
      </div>
    ),
    cell: ({ row }) => {
      const createdBy = row.original.createdBy;
      const currentId = row.original.createdById ?? "unknown";
      const label = createdBy ? getUserDisplayName(createdBy) : "Unknown";

      return (
        <div className="max-w-[140px]" onClick={(e) => e.stopPropagation()}>
          <Select value={currentId} onValueChange={(newId) => {
            const newCreatedBy = newId === "unknown"
              ? null
              : memberOptions.find((m) => m.user.id === newId)?.user ?? null;

            const updatedEntry: CashflowEntry = {
              ...row.original,
              createdById: newId === "unknown" ? null : newId,
              createdBy: newCreatedBy,
            };

            updateEntryInCashflowCache(queryClient, updatedEntry);

            editEntry(row.original.id, {
              createdById: newId === "unknown" ? null : newId,
            }).catch((error) => {
              console.error("Failed to update creator:", error);
              queryClient.invalidateQueries({ queryKey: ["cashflow-entries"] });
            });
          }}>
            <SelectTrigger className="h-7 gap-1 border-0 bg-transparent p-0 text-xs shadow-none hover:bg-muted/50">
              <UserAvatar user={createdBy} size={18} className="size-[18px] text-[9px]" />
              <span className="truncate text-muted-foreground">{label}</span>
            </SelectTrigger>
            <SelectContent>
              {memberOptions.map((member) => (
                <SelectItem key={member.user.id} value={member.user.id}>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={member.user} size={18} className="size-[18px] text-[9px]" />
                    <span>{getUserDisplayName(member.user)}</span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="unknown">Unknown/System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <button
        className="flex w-full items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={column.getToggleSortingHandler()}
        title={
          column.getIsSorted() === "asc"
            ? "Sorted ascending"
            : column.getIsSorted() === "desc"
              ? "Sorted descending"
              : "Click to sort"
        }
      >
        <HugeiconsIcon icon={Calendar01Icon} size={16} className="text-muted-foreground shrink-0" />
        <span>Tanggal</span>
        {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : null}
      </button>
    ),
    cell: ({ row }) => {
      const date = row.getValue("date") as string | null;
      if (!date) return <span className="text-muted-foreground">-</span>;
      const formatted = new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return <span>{formatted}</span>;
    },
  },
  {
    accessorKey: "io",
    header: ({ column }) => (
      <button
        className="flex w-full items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
        onClick={column.getToggleSortingHandler()}
        title={
          column.getIsSorted() === "asc"
            ? "Sorted ascending"
            : column.getIsSorted() === "desc"
              ? "Sorted descending"
              : "Click to sort"
        }
      >
        <HugeiconsIcon icon={ArrowUpDownIcon} size={16} className="text-muted-foreground shrink-0" />
        <span>I/O</span>
        {column.getIsSorted() === "asc" ? " ↑" : column.getIsSorted() === "desc" ? " ↓" : null}
      </button>
    ),
    cell: ({ row }) => {
      const io = row.getValue("io") as IOType | null;
      if (!io) return <span className="text-muted-foreground">-</span>;
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            io === "Income"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {io}
        </span>
      );
    },
    filterFn: (row, id, value) => {
      return value === "all" || row.getValue(id) === value;
    },
  },
]; }

const ioOptions: IOType[] = ["Income", "Expenses"];

const PAGE_SIZE = 20;

interface CashflowTableProps {
  dateFilter?: string;
}

export function CashflowTable({ dateFilter }: CashflowTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const { format } = useCurrency();
  
  // Separate state for I/O filter to drive the query
  const [ioQueryFilter, setIoQueryFilter] = React.useState<string>("all");
  const [creatorQueryFilter, setCreatorQueryFilter] = React.useState<string>("all");

  // State for the edit drawer
  const [editingEntry, setEditingEntry] = React.useState<CashflowEntry | null>(null);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();
  const pendingCashflow = useCashflowPending();
  const categoriesQuery = useCategories();
  const membersQuery = useManagementMembers();
  const categoryOptions = React.useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const memberOptions = React.useMemo(() => membersQuery.data ?? [], [membersQuery.data]);

  // Bulk delete handler
  const handleBulkDelete = React.useCallback(async () => {
    const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.length} entri terpilih?`)) return;

    await queryClient.cancelQueries({ queryKey: cashflowQueryKeys.entries });
    const previousEntries = snapshotCashflowEntries(queryClient);
    removeEntriesFromCashflowCache(queryClient, selectedIds);
    setRowSelection({});

    const endPending = beginCashflowPending("Deleting from database...");

    try {
      await Promise.all(selectedIds.map((id) => removeEntry(id)));
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.entries });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.summary });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.activity });
      queryClient.invalidateQueries({ queryKey: cashflowQueryKeys.analyticsRoot });
    } catch (error) {
      restoreCashflowEntries(queryClient, previousEntries);
      console.error("Failed to delete entries:", error);
    } finally {
      endPending();
    }
  }, [rowSelection, queryClient]);

  // Ref for the sentinel element at the bottom
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // Infinite query for paginated data fetching with I/O filter support
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["cashflow-entries", ioQueryFilter, creatorQueryFilter, dateFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await fetchEntriesFiltered({
        pageSize: PAGE_SIZE,
        skip: pageParam as number,
        io: ioQueryFilter === "all" ? undefined : (ioQueryFilter as IOType),
        createdById: creatorQueryFilter === "all" ? undefined : creatorQueryFilter === "unknown" ? null : creatorQueryFilter,
        date: dateFilter,
      });
      return result;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.entries.length, 0);
      return lastPage.hasMore ? loadedCount : undefined;
    },
  });

  // Flatten all pages into a single array
  const entries = React.useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.entries);
  }, [data]);

  const columns = React.useMemo(() => getColumns({ format, memberOptions, queryClient }), [format, memberOptions, queryClient]);

  const table = useReactTable({
    data: entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
  });

  // Intersection Observer for infinite scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // When the sentinel element comes into view, fetch more data
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handler for I/O filter that updates both query and table filter
  const handleIoFilterChange = React.useCallback((value: string) => {
    setIoQueryFilter(value);
    table.getColumn("io")?.setFilterValue(value);
  }, [table]);

  if (isLoading) {
    return <CashflowTableSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-red-500">Error: {error?.message || "Failed to load data"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tercatat</h2>
        {pendingCashflow.count > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3.5 animate-spin text-primary" />
            <span>{pendingCashflow.label}</span>
          </div>
        )}
      </div>

      <div className="relative">
        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Global Search */}
          <Input
            placeholder="Search by name..."
            value={globalFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value)}
            className="flex-1 min-w-0"
          />

          {/* Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M7 12h10" />
                  <path d="M11 18h2" />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 space-y-3">
              {/* I/O Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select
                  value={ioQueryFilter}
                  onValueChange={handleIoFilterChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="I/O" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {ioOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select
                  value={(table.getColumn("category")?.getFilterValue() as string) ?? "all"}
                  onValueChange={(value: string) =>
                    table.getColumn("category")?.setFilterValue(value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Creator Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ditambah oleh</label>
                <Select value={creatorQueryFilter} onValueChange={setCreatorQueryFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Creator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {memberOptions.map((member) => (
                      <SelectItem key={member.user.id} value={member.user.id}>
                        {getUserDisplayName(member.user)}
                      </SelectItem>
                    ))}
                    <SelectItem value="unknown">Unknown/System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Bulk Actions Bar */}
        {Object.values(rowSelection).filter(Boolean).length > 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-between rounded-md border bg-background px-4 py-2 pr-0 shadow-sm">
            <span className="text-sm text-muted-foreground">
              {Object.values(rowSelection).filter(Boolean).length} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleBulkDelete}
            >
              <HugeiconsIcon icon={Delete03Icon} strokeWidth={2} className="size-4" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <HugeiconsIcon icon={File01Icon} strokeWidth={1.5} className="size-10" />
          <p className="text-sm font-medium">
            {dateFilter ? "Hayo hari ini belum nyatet keuangan yaa? 😜" : "Belum ada tercatat"}
          </p>
          <p className="text-xs">
            {dateFilter
              ? "Catat pengeluaran atau pemasukan hari ini biar keuanganmu terkontrol."
              : "Mulai dengan mencatat pengeluaran atau pemasukan."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => setEditingEntry(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Infinite scroll trigger and status */}
      <div className="flex items-center justify-center py-4">
        <div ref={loadMoreRef} className="text-sm text-muted-foreground">
          {isFetchingNextPage ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Memuat lebih banyak...
            </span>
          ) : hasNextPage ? (
            "Scroll down to load more..."
          ) : (
            `Menampilkan ${entries.length} tercatat`
          )}
        </div>
      </div>
      {editingEntry && (
        <CashflowFormDrawer
          mode="edit"
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
        />
      )}
    </div>
  );
}
