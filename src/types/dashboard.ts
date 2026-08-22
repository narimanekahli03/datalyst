export type ChartType = "line" | "bar" | "area" | "pie" | "scatter";

export type AggregationType = "sum" | "avg" | "count" | "min" | "max";

export type DashboardViewMode = "charts" | "table";

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  /** Dimension column. Required for every type except when data is unavailable. */
  xField: string | null;
  /** Measure column(s). Scatter and pie are constrained to a single entry by the builder UI. */
  yFields: string[];
  /** Ignored for "scatter" (raw points are plotted, nothing is aggregated). */
  aggregation: AggregationType;
  /** Secondary category used to split into series. Only meaningful when yFields.length === 1. */
  groupByField: string | null;
  createdAt: number;
}

export interface KpiConfig {
  id: string;
  label: string;
  /** null means "count of rows" regardless of aggregation. */
  field: string | null;
  aggregation: AggregationType;
}

export interface ChartSeriesMeta {
  /** Key looked up on each data point (Recharts dataKey). */
  key: string;
  /** Legend / tooltip label. */
  label: string;
  color: string;
}

export interface ChartRenderData {
  /** Rows ready to feed to Recharts. A null measure means "no data for this
   *  point" (rendered as a gap), distinct from a real zero. */
  data: Record<string, string | number | null>[];
  series: ChartSeriesMeta[];
  /** Key holding the X-axis / category value in each data row ("x" for scatter, "name" for pie). */
  xKey: string;
  /** True when there is nothing plottable (no rows, or config incomplete). */
  isEmpty: boolean;
  /** Configured column names that no longer exist in the current dataset. */
  missingColumns: string[];
}
