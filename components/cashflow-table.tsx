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
  HeadingIcon,
  Money01Icon,
  Tag01Icon,
  Calendar01Icon,
  ArrowUpDownIcon,
  Delete03Icon,
  Loading03Icon,
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
import { CashflowEntry, IOType, CategoryType } from "@/lib/notion";
import { getCategoryConfig } from "@/lib/categories";
import { fetchEntriesFiltered, removeEntry } from "@/app/actions/cashflow";
import { EditEntryDrawer } from "@/components/edit-entry-drawer";
import { useQueryClient } from "@tanstack/react-query";
import {
  removeEntriesFromCashflowCache,
  restoreCashflowEntries,
  snapshotCashflowEntries,
} from "@/lib/cashflow-query-cache";
import { beginCashflowPending, useCashflowPending } from "@/lib/cashflow-pending";
import { cashflowQueryKeys, useCategories } from "@/hooks/use-cashflow-data";

const columns: ColumnDef<CashflowEntry>[] = [
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

      const abs = Math.abs(amount);
      let formatted: string;
      if (abs >= 1_000_000) {
        const val = abs / 1_000_000;
        formatted = `Rp${val.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
      } else if (abs >= 1_000) {
        const val = abs / 1_000;
        formatted = `Rp${val.toLocaleString("id-ID", { maximumFractionDigits: 1 })}k`;
      } else {
        formatted = `Rp${abs.toLocaleString("id-ID")}`;
      }

      return (
        <div className={`text-right font-medium ${isIncome ? "text-green-600 dark:text-green-400" : "text-red-900 dark:text-red-500"}`}>
          {formatted}
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
];

const ioOptions: IOType[] = ["Income", "Expenses"];

const PAGE_SIZE = 20;

export function CashflowTable() {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  
  // Separate state for I/O filter to drive the query
  const [ioQueryFilter, setIoQueryFilter] = React.useState<string>("all");

  // State for the edit drawer
  const [editingEntry, setEditingEntry] = React.useState<CashflowEntry | null>(null);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();
  const pendingCashflow = useCashflowPending();
  const categoriesQuery = useCategories();
  const categoryOptions = categoriesQuery.data ?? [];

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
    queryKey: ["cashflow-entries", ioQueryFilter],
    queryFn: async ({ pageParam }) => {
      const result = await fetchEntriesFiltered({
        pageSize: PAGE_SIZE,
        cursor: pageParam as string | null,
        io: ioQueryFilter === "all" ? undefined : (ioQueryFilter as IOType),
      });
      return result;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
  });

  // Flatten all pages into a single array
  const entries = React.useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.entries);
  }, [data]);

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
        <h2 className="text-sm font-semibold text-foreground">Entries</h2>
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

      {/* Table */}
      <div className="rounded-md border">
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
              Loading more entries...
            </span>
          ) : hasNextPage ? (
            "Scroll down to load more..."
          ) : (
            `Showing ${entries.length} entries (all loaded)`
          )}
        </div>
      </div>
      {editingEntry && (
        <EditEntryDrawer
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => { if (!open) setEditingEntry(null); }}
        />
      )}
    </div>
  );
}
