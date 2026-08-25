import type { CellValue } from "@/types/dataset";
import type { DatasetSchemaPayload } from "@/types/textToSql";
import type { Insight } from "@/types/insights";
import type { AggregationType, ChartType } from "@/types/dashboard";

/** One step the agent has already taken — sent back on every subsequent
 * request so the model can see what it already tried and learned. */
export interface AgentStepRecord {
  action: "query" | "chart";
  reasoning: string;
  // query fields
  sql?: string | null;
  row_count?: number | null;
  columns?: string[] | null;
  sample_rows?: Record<string, CellValue>[] | null;
  error_message?: string | null;
  // chart fields
  chart_title?: string | null;
  chart_type?: ChartType | null;
  chart_x_field?: string | null;
  chart_y_fields?: string[] | null;
  chart_aggregation?: AggregationType | null;
}

export interface AgentStepRequest {
  schema: DatasetSchemaPayload;
  history: AgentStepRecord[];
  step_number: number;
  max_steps: number;
  must_finish: boolean;
}

export interface AgentStepResponse {
  action: "query" | "chart" | "finish";
  sql?: string;
  reasoning?: string;
  chart_title?: string;
  chart_type?: ChartType;
  chart_x_field?: string;
  chart_y_fields?: string[];
  chart_aggregation?: AggregationType;
  summary?: string;
  findings?: Insight[];
}

/** One entry in the live trail rendered in the UI — the step plus its outcome. */
export interface AgentTrailEntry {
  stepNumber: number;
  action: "query" | "chart";
  reasoning: string;
  sql: string | null;
  result: { rowCount: number; columns: string[] } | null; // null while a query step is in flight
  chart: {
    title: string;
    type: ChartType;
    xField: string;
    yFields: string[];
    aggregation: AggregationType;
  } | null;
  errorMessage: string | null;
}

export type AgentPhase = "idle" | "thinking" | "executing" | "done" | "error";
