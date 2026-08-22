export type ReportBlockType = "text" | "chart" | "kpi" | "table" | "insights" | "query";

export interface TextBlock {
  id: string;
  type: "text";
  heading: string;
  content: string;
}

export interface ChartBlock {
  id: string;
  type: "chart";
  /** References a ChartConfig.id from dashboardStore — resolved at render time. */
  chartId: string | null;
}

export interface KpiBlock {
  id: string;
  type: "kpi";
}

export type TableRowLimit = 10 | 20 | 50;

export interface TableBlock {
  id: string;
  type: "table";
  maxRows: TableRowLimit;
}

/** Shows the current AI-generated observations (insightsStore) — nothing to configure. */
export interface InsightsBlock {
  id: string;
  type: "insights";
}

export interface QueryBlock {
  id: string;
  type: "query";
  /** References a TextToSqlHistoryEntry.id from textToSqlStore — resolved at render time. */
  queryEntryId: string | null;
}

export type ReportBlock = TextBlock | ChartBlock | KpiBlock | TableBlock | InsightsBlock | QueryBlock;

export interface ReportConfig {
  title: string;
  subtitle: string;
  date: string;
  /** Data URL (uploaded image, small — kept in memory only, never persisted). */
  logoDataUrl: string | null;
  blocks: ReportBlock[];
}
