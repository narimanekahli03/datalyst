import type { DatasetExploration } from "@/types/explore";
import type { ColumnInsightSummary, CorrelationSummary, InsightsRequestPayload } from "@/types/insights";

const MAX_TOP_VALUES = 3;
const MAX_CORRELATIONS = 5;
/** Below this, a correlation is noise-level and not worth an LLM mentioning. */
const MIN_CORRELATION_STRENGTH = 0.4;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function summarizeColumn(column: DatasetExploration["columns"][number]): ColumnInsightSummary {
  const base: ColumnInsightSummary = {
    name: column.name,
    type: column.columnType,
    missing_percent: round(column.missingPercent),
  };

  if (column.stats.kind === "number") {
    return {
      ...base,
      mean: round(column.stats.mean),
      median: round(column.stats.median),
      min: round(column.stats.min),
      max: round(column.stats.max),
      std_dev: round(column.stats.stdDev),
      outlier_percent: round(column.stats.outlierPercent),
    };
  }

  if (column.stats.kind === "date") {
    return {
      ...base,
      date_min: column.stats.min,
      date_max: column.stats.max,
      range_days: column.stats.rangeDays,
    };
  }

  return {
    ...base,
    unique_count: column.stats.uniqueCount,
    top_values: column.stats.topValues
      .slice(0, MAX_TOP_VALUES)
      .map((v) => ({ value: v.value, percent: round(v.percent) })),
  };
}

/**
 * Builds a compact statistics summary (never raw rows) for /generate-insights,
 * reusing the same computation the Explore page already runs — so the AI
 * narrates real numbers instead of guessing from sample values.
 */
export function buildInsightsPayload(exploration: DatasetExploration): InsightsRequestPayload {
  const topCorrelations: CorrelationSummary[] = exploration.correlations
    .filter((c) => Math.abs(c.r) >= MIN_CORRELATION_STRENGTH)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, MAX_CORRELATIONS)
    .map((c) => ({ column_a: c.columnA, column_b: c.columnB, r: round(c.r) }));

  return {
    row_count: exploration.rowCount,
    column_count: exploration.columnCount,
    duplicate_row_count: exploration.duplicateRowCount,
    missing_percent: round(exploration.missingPercent),
    columns: exploration.columns.map(summarizeColumn),
    top_correlations: topCorrelations,
  };
}