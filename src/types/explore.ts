export interface HistogramBin {
  label: string;
  count: number;
}

export interface FrequencyEntry {
  value: string;
  count: number;
  percent: number;
}

export interface NumericColumnStats {
  kind: "number";
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
  histogram: HistogramBin[];
  outlierCount: number;
  outlierPercent: number;
  lowerFence: number;
  upperFence: number;
}

export interface CategoricalColumnStats {
  kind: "categorical";
  count: number;
  uniqueCount: number;
  topValues: FrequencyEntry[];
}

export interface DateColumnStats {
  kind: "date";
  count: number;
  min: string;
  max: string;
  rangeDays: number;
  timeline: HistogramBin[];
}

export type ColumnKindStats = NumericColumnStats | CategoricalColumnStats | DateColumnStats;

export interface ColumnExploration {
  name: string;
  /** Original detected column type — "boolean" is treated as categorical for stats purposes. */
  columnType: "string" | "number" | "date" | "boolean";
  missingCount: number;
  missingPercent: number;
  stats: ColumnKindStats;
}

export interface CorrelationPair {
  columnA: string;
  columnB: string;
  r: number;
  sampleSize: number;
}

export interface DatasetExploration {
  rowCount: number;
  columnCount: number;
  totalMissing: number;
  missingPercent: number;
  duplicateRowCount: number;
  estimatedBytes: number;
  columns: ColumnExploration[];
  correlations: CorrelationPair[];
}
