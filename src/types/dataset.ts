export type ColumnType = "string" | "number" | "date" | "boolean";

export interface ColumnMeta {
  /** Column name as displayed and used as the row key. */
  name: string;
  type: ColumnType;
}

export type CellValue = string | number | boolean | null;

/**
 * A data row. `__rowId` is an internal stable identifier (not derived from
 * content) used for React keys, TanStack row selection, and undo snapshots.
 * It is stripped before export.
 */
export type DataRow = { __rowId: string } & Record<string, CellValue>;

export type SourceFileType = "csv" | "xlsx";

export interface Dataset {
  fileName: string;
  fileType: SourceFileType;
  columns: ColumnMeta[];
  rows: DataRow[];
}

export type MissingValueStrategy =
  | "drop-row"
  | "fill-value"
  | "fill-mean"
  | "fill-median";

export interface HistoryEntry {
  id: string;
  label: string;
  detail: string;
  timestamp: number;
  /** Full dataset snapshot taken BEFORE the operation was applied. */
  snapshot: Dataset;
}

export interface ColumnStats {
  name: string;
  type: ColumnType;
  missingCount: number;
  missingPercent: number;
}

export interface DatasetStats {
  rowCount: number;
  columnCount: number;
  duplicateRowCount: number;
  totalMissingCount: number;
  columns: ColumnStats[];
}

export interface OperationResult {
  label: string;
  detail: string;
  affectedCount: number;
}
