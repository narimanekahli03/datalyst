import type { CellValue, ColumnMeta, Dataset, DataRow } from "@/types/dataset";
import type {
  CategoricalColumnStats,
  ColumnExploration,
  ColumnKindStats,
  CorrelationPair,
  DatasetExploration,
  DateColumnStats,
  HistogramBin,
  NumericColumnStats,
} from "@/types/explore";
import { countDuplicateRows } from "@/lib/dataStats";

function isMissing(value: CellValue): boolean {
  return value === null || value === "";
}

/** Linear-interpolation percentile (matches Excel PERCENTILE.INC / numpy default). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function sturgesBinCount(n: number): number {
  if (n <= 1) return 1;
  return Math.min(10, Math.max(5, Math.ceil(Math.log2(n) + 1)));
}

function roundLabel(value: number): number {
  return Number.isInteger(value) ? value : Math.round(value * 10) / 10;
}

function buildHistogram(sortedValues: number[]): HistogramBin[] {
  if (sortedValues.length === 0) return [];
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  if (min === max) {
    return [{ label: `${roundLabel(min)}`, count: sortedValues.length }];
  }

  const binCount = sturgesBinCount(sortedValues.length);
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * width,
    end: i === binCount - 1 ? max : min + (i + 1) * width,
    count: 0,
  }));

  for (const value of sortedValues) {
    let index = Math.floor((value - min) / width);
    if (index >= binCount) index = binCount - 1;
    if (index < 0) index = 0;
    bins[index].count += 1;
  }

  return bins.map((bin) => ({
    label: `${roundLabel(bin.start)}–${roundLabel(bin.end)}`,
    count: bin.count,
  }));
}

const EMPTY_NUMERIC_STATS: NumericColumnStats = {
  kind: "number",
  count: 0,
  mean: 0,
  median: 0,
  min: 0,
  max: 0,
  stdDev: 0,
  q1: 0,
  q3: 0,
  iqr: 0,
  histogram: [],
  outlierCount: 0,
  outlierPercent: 0,
  lowerFence: 0,
  upperFence: 0,
};

function computeNumericStats(values: number[]): NumericColumnStats {
  if (values.length === 0) return EMPTY_NUMERIC_STATS;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  // Sample standard deviation (n-1) — matches Excel STDEV / pandas default,
  // the convention most spreadsheet-literate users already expect.
  const variance =
    n > 1 ? sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  // Tukey's fences (1.5×IQR) — the standard, explainable outlier rule.
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const outlierCount = sorted.filter((v) => v < lowerFence || v > upperFence).length;

  return {
    kind: "number",
    count: n,
    mean,
    median: percentile(sorted, 0.5),
    min: sorted[0],
    max: sorted[n - 1],
    stdDev: Math.sqrt(variance),
    q1,
    q3,
    iqr,
    histogram: buildHistogram(sorted),
    outlierCount,
    outlierPercent: (outlierCount / n) * 100,
    lowerFence,
    upperFence,
  };
}

function computeCategoricalStats(labels: string[]): CategoricalColumnStats {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);

  const total = labels.length;
  const topValues = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({
      value,
      count,
      percent: total === 0 ? 0 : (count / total) * 100,
    }));

  return { kind: "categorical", count: total, uniqueCount: counts.size, topValues };
}

function bucketKeyForDate(iso: string, rangeDays: number): string {
  if (rangeDays <= 62) return iso; // daily
  if (rangeDays <= 730) return iso.slice(0, 7); // yyyy-mm
  return iso.slice(0, 4); // yyyy
}

function computeDateStats(values: string[]): DateColumnStats {
  if (values.length === 0) return { kind: "date", count: 0, min: "", max: "", rangeDays: 0, timeline: [] };

  const sorted = [...values].sort();
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const rangeDays = Math.round((Date.parse(max) - Date.parse(min)) / 86_400_000);

  const counts = new Map<string, number>();
  for (const value of values) {
    const key = bucketKeyForDate(value, rangeDays);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const timeline = [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([label, count]) => ({ label, count }));

  return { kind: "date", count: values.length, min, max, rangeDays, timeline };
}

function exploreColumn(column: ColumnMeta, rows: DataRow[]): ColumnExploration {
  const rawValues = rows.map((row) => row[column.name] ?? null);
  const missingCount = rawValues.filter(isMissing).length;
  const nonMissing = rawValues.filter((v) => !isMissing(v));

  let stats: ColumnKindStats;
  if (column.type === "number") {
    stats = computeNumericStats(nonMissing.filter((v): v is number => typeof v === "number"));
  } else if (column.type === "date") {
    stats = computeDateStats(nonMissing.filter((v): v is string => typeof v === "string"));
  } else {
    const labels = nonMissing.map((v) => (typeof v === "boolean" ? (v ? "Vrai" : "Faux") : String(v)));
    stats = computeCategoricalStats(labels);
  }

  return {
    name: column.name,
    columnType: column.type,
    missingCount,
    missingPercent: rows.length === 0 ? 0 : (missingCount / rows.length) * 100,
    stats,
  };
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) return null;
  return covariance / Math.sqrt(varianceX * varianceY);
}

function computeCorrelations(columns: ColumnMeta[], rows: DataRow[]): CorrelationPair[] {
  const numericNames = columns.filter((c) => c.type === "number").map((c) => c.name);
  const pairs: CorrelationPair[] = [];

  for (let i = 0; i < numericNames.length; i++) {
    for (let j = i + 1; j < numericNames.length; j++) {
      const columnA = numericNames[i];
      const columnB = numericNames[j];
      const xs: number[] = [];
      const ys: number[] = [];
      for (const row of rows) {
        const a = row[columnA];
        const b = row[columnB];
        // Pairwise deletion: only rows where both measures are present.
        if (typeof a === "number" && typeof b === "number") {
          xs.push(a);
          ys.push(b);
        }
      }
      const r = pearson(xs, ys);
      if (r !== null) pairs.push({ columnA, columnB, r, sampleSize: xs.length });
    }
  }

  return pairs;
}

/** Rough in-memory footprint, for a "how much data is this" sense of scale — not a precise byte count. */
function estimateBytes(dataset: Dataset): number {
  const columnNames = dataset.columns.map((c) => c.name);
  return dataset.rows.reduce((sum, row) => {
    let rowBytes = 0;
    for (const name of columnNames) {
      const value = row[name];
      rowBytes += value === null ? 4 : String(value).length * 2;
    }
    return sum + rowBytes;
  }, 0);
}

export function computeExploration(dataset: Dataset): DatasetExploration {
  const { rows, columns } = dataset;
  const columnExplorations = columns.map((column) => exploreColumn(column, rows));
  const totalMissing = columnExplorations.reduce((sum, c) => sum + c.missingCount, 0);
  const totalCells = rows.length * columns.length;

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    totalMissing,
    missingPercent: totalCells === 0 ? 0 : (totalMissing / totalCells) * 100,
    duplicateRowCount: countDuplicateRows(dataset),
    estimatedBytes: estimateBytes(dataset),
    columns: columnExplorations,
    correlations: computeCorrelations(columns, rows),
  };
}
