import type { ColumnType } from "@/types/dataset";

export type InsightCategory = "qualite" | "distribution" | "correlation" | "categorie" | "general";

export interface Insight {
  text: string;
  category: InsightCategory;
}

export interface TopValueSummary {
  value: string;
  percent: number;
}

/** Compact per-column statistics sent as grounding context — never the raw rows. */
export interface ColumnInsightSummary {
  name: string;
  type: ColumnType;
  missing_percent: number;
  // number columns
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std_dev?: number;
  outlier_percent?: number;
  // string/boolean columns
  unique_count?: number;
  top_values?: TopValueSummary[];
  // date columns
  date_min?: string;
  date_max?: string;
  range_days?: number;
}

export interface CorrelationSummary {
  column_a: string;
  column_b: string;
  r: number;
}

export interface InsightsRequestPayload {
  row_count: number;
  column_count: number;
  duplicate_row_count: number;
  missing_percent: number;
  columns: ColumnInsightSummary[];
  top_correlations: CorrelationSummary[];
}

export interface InsightsResponse {
  insights: Insight[];
}