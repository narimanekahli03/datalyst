import { useMemo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import type { CellValue } from "@/types/dataset";
import type { QueryResult } from "@/types/textToSql";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatNumber } from "@/lib/utils";

interface QueryResultTableProps {
  result: QueryResult;
}

const MAX_DISPLAYED_ROWS = 200;

export function QueryResultTable({ result }: QueryResultTableProps) {
  const displayRows = useMemo(() => result.rows.slice(0, MAX_DISPLAYED_ROWS), [result.rows]);

  const columns = useMemo<ColumnDef<Record<string, CellValue>>[]>(
    () =>
      result.columns.map((name) => ({
        id: name,
        accessorKey: name,
        header: () => <span className="font-semibold text-foreground">{name}</span>,
        cell: ({ getValue }) => {
          const value = getValue<CellValue>();
          const isEmpty = value === null;
          const isNumber = typeof value === "number";
          return (
            <span
              className={cn(
                isEmpty && "italic text-muted-foreground/70",
                isNumber && "tabular-nums"
              )}
            >
              {isEmpty ? "-" : isNumber ? formatNumber(value) : String(value)}
            </span>
          );
        },
      })),
    [result.columns]
  );

  const table = useReactTable({
    data: displayRows,
    columns,
    getRowId: (_row, index) => String(index),
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="scrollbar-thin max-h-[420px] overflow-auto">
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
                  Aucun résultat pour cette requête.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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

      {result.rows.length > MAX_DISPLAYED_ROWS && (
        <div className="border-t border-border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
          Affichage limité aux {formatNumber(MAX_DISPLAYED_ROWS)} premières lignes sur{" "}
          {formatNumber(result.rows.length)}.
        </div>
      )}
    </div>
  );
}
