import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { CellValue, DataRow, Dataset } from "@/types/dataset";
import { TYPE_LABELS, TYPE_DOT, formatCellValue } from "@/lib/columnTypeMeta";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";

interface DataTableProps {
  dataset: Dataset;
}

const PAGE_SIZE = 25;

export function DataTable({ dataset }: DataTableProps) {
  const [pageIndex, setPageIndex] = useState(0);

  const columns = useMemo<ColumnDef<DataRow>[]>(
    () =>
      dataset.columns.map((col) => ({
        id: col.name,
        accessorKey: col.name,
        header: () => (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[col.type])} />
            <span className="truncate font-semibold text-foreground" title={col.name}>
              {col.name}
            </span>
            <span className="shrink-0 text-[11px] font-normal normal-case text-muted-foreground">
              {TYPE_LABELS[col.type]}
            </span>
          </div>
        ),
        cell: ({ getValue }) => {
          const value = getValue<CellValue>();
          const isEmpty = value === null || value === "";
          return (
            <span
              className={cn(
                isEmpty && "italic text-muted-foreground/70",
                col.type === "number" && !isEmpty && "tabular-nums"
              )}
            >
              {formatCellValue(value)}
            </span>
          );
        },
      })),
    [dataset.columns]
  );

  const table = useReactTable({
    data: dataset.rows,
    columns,
    state: { pagination: { pageIndex, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater;
      setPageIndex(next.pageIndex);
    },
    getRowId: (row) => row.__rowId,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex;
  const rowCount = dataset.rows.length;
  const rangeStart = rowCount === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(rowCount, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="scrollbar-thin max-h-[560px] overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-[13px]">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-14 text-center text-muted-foreground">
                  Aucune ligne à afficher.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-[13px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/40 px-4 py-2.5">
        <p className="text-xs tabular-nums text-muted-foreground">
          {rowCount === 0
            ? "0 ligne"
            : `Lignes ${formatNumber(rangeStart)}–${formatNumber(rangeEnd)} sur ${formatNumber(rowCount)}`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[5.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground">
            Page {pageCount === 0 ? 0 : currentPage + 1} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
