import type { QueryResult } from "@/types/textToSql";

export interface AutoChartSpec {
  xKey: string;
  yKey: string;
}

const MAX_CHARTABLE_ROWS = 50;

/**
 * A query result is worth auto-charting when it has the shape of an
 * aggregation: exactly one numeric column paired with exactly one
 * non-numeric (categorical) column, over a small-enough row count to read
 * as a bar chart. Anything else (raw row dumps, multi-metric results,
 * single scalars) falls back to table-only — a bad chart is worse than no chart.
 */
export function inferAutoChart(result: QueryResult): AutoChartSpec | null {
  if (result.rows.length === 0 || result.rows.length > MAX_CHARTABLE_ROWS) return null;
  if (result.columns.length !== 2) return null;

  const numericColumns: string[] = [];
  const otherColumns: string[] = [];

  for (const column of result.columns) {
    const values = result.rows.map((row) => row[column]).filter((v) => v !== null);
    const isNumeric = values.length > 0 && values.every((v) => typeof v === "number");
    (isNumeric ? numericColumns : otherColumns).push(column);
  }

  if (numericColumns.length !== 1 || otherColumns.length !== 1) return null;
  return { xKey: otherColumns[0], yKey: numericColumns[0] };
}
