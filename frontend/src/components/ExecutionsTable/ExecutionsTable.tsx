"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { parseISO } from "date-fns";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ExternalLink,
  Plane,
  SearchX,
  Trash2,
} from "lucide-react";
import type { ExecutionRow } from "@/lib/types/execution";
import type { ExecutionsTableProps } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from "./constants";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "running":
    case "pending":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export function ExecutionsTable({ data, loading, onDelete }: ExecutionsTableProps) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<ExecutionRow>[]>(
    () => [
      {
        id: "route",
        header: "Route",
        accessorFn: (row) => `${row.origin} → ${row.destination}`,
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            {row.original.origin} → {row.original.destination}
          </span>
        ),
      },
      {
        id: "departureDate",
        header: "Departure",
        accessorFn: (row) => row.departureDate,
        cell: ({ getValue }) => (
          <span className="text-slate-300">{formatShortDate(getValue() as string | null)}</span>
        ),
      },
      {
        id: "returnDate",
        header: "Return",
        accessorFn: (row) => row.returnDate,
        cell: ({ getValue }) => (
          <span className="text-slate-400">{formatShortDate(getValue() as string | null)}</span>
        ),
      },
      {
        id: "cabinClass",
        header: "Cabin",
        accessorFn: (row) => row.cabinClass ?? "—",
        cell: ({ getValue }) => (
          <span className="text-slate-400 text-xs capitalize">
            {String(getValue())}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)} className="text-[10px] font-bold uppercase">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "resultCount",
        header: "Results",
        accessorFn: (row) => row.resultCount,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-bold text-slate-300">
            {(getValue() as number) > 0 ? String(getValue()) : "—"}
          </span>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        accessorFn: (row) => row.createdAt,
        cell: ({ getValue }) => (
          <span className="text-slate-500 text-xs">{formatDate(getValue() as string | null)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const searchId = row.original.searchId;
          const isDeleting = deletingId === searchId;

          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                asChild
                className="text-slate-400 hover:text-white"
              >
                <Link href={`/history/${searchId}`} title="Timeline">
                  <Plane className="size-3.5" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                asChild
                className="text-slate-400 hover:text-white"
              >
                <Link href={`/results/${searchId}`} title="Results">
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-slate-400 hover:text-red-400"
                      title="Delete"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this search?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the search for{" "}
                        <strong>{row.original.origin} → {row.original.destination}</strong>{" "}
                        and all associated results. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 text-white hover:bg-red-700"
                        onClick={async () => {
                          setDeletingId(searchId);
                          try {
                            await onDelete(searchId);
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          );
        },
      },
    ],
    [deletingId, onDelete]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
  });

  /* c8 ignore start -- Radix Select onValueChange cannot fire in jsdom */
  const handlePageSizeChange = (v: string) => {
    table.setPageSize(Number(v));
  };
  /* c8 ignore stop */

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-brand-purple" />
          <p className="text-sm font-medium text-slate-500">Loading executions...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 py-12">
        <SearchX className="size-10 text-slate-500" />
        <p className="text-sm font-medium text-slate-400">No executions yet</p>
        <p className="text-center text-xs text-slate-500">
          Run a flight search from the dashboard to see execution history here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/10 bg-white/5">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 transition-colors hover:bg-white/5"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-sm"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Rows per page
            </span>
            {/* c8 ignore start -- Radix Select internals don't render/fire in jsdom */}
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="h-8 w-[72px] rounded-lg border border-white/10 bg-white/5 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* c8 ignore stop */}
          </div>
          <span className="text-xs text-slate-500">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              data.length
            )}{" "}
            of {data.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[80px] px-2 text-center text-xs font-medium text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
            className="border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
