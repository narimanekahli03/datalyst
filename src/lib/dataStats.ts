import type { ColumnStats, Dataset, DatasetStats } from "@/types/dataset";

function isMissing(value: unknown): boolean {
  return value === null || value === "";
}

function rowSignature(row: Dataset["rows"][number], columns: string[]): string {
  return JSON.stringify(columns.map((name) => row[name] ?? null));
}

/** Counts rows that duplicate an earlier row across every column. */
export function countDuplicateRows(dataset: Dataset): number {
  const columnNames = dataset.columns.map((c) => c.name);
  const seen = new Set<string>();
  let duplicateRowCount = 0;
  for (const row of dataset.rows) {
    const signature = rowSignature(row, columnNames);
    if (seen.has(signature)) {
      duplicateRowCount += 1;
    } else {
      seen.add(signature);
    }
  }
  return duplicateRowCount;
}

export function computeDatasetStats(dataset: Dataset): DatasetStats {
  const { rows, columns } = dataset;

  const columnStats: ColumnStats[] = columns.map((column) => {
    const missingCount = rows.reduce(
      (count, row) => count + (isMissing(row[column.name]) ? 1 : 0),
      0
    );
    return {
      name: column.name,
      type: column.type,
      missingCount,
      missingPercent: rows.length === 0 ? 0 : (missingCount / rows.length) * 100,
    };
  });

  const totalMissingCount = columnStats.reduce(
    (sum, col) => sum + col.missingCount,
    0
  );

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    duplicateRowCount: countDuplicateRows(dataset),
    totalMissingCount,
    columns: columnStats,
  };
}
