import type { CellValue } from "@/types/dataset";
import type { DatasetSchemaPayload } from "@/types/textToSql";
import type { Insight } from "@/types/insights";

/** One step the agent has already taken — sent back on every subsequent
 * request so the model can see what it already tried and learned. */
export interface AgentStepRecord {
  sql: string;
  reasoning: string;
  row_count: number;
  columns: string[];
  sample_rows: Record<string, CellValue>[];
  error_message: string | null;
}

export interface AgentStepRequest {
  schema: DatasetSchemaPayload;
  history: AgentStepRecord[];
  step_number: number;
  max_steps: number;
  must_finish: boolean;
}

export interface AgentStepResponse {
  action: "query" | "finish";
  sql?: string;
  reasoning?: string;
  summary?: string;
  findings?: Insight[];
}

/** One entry in the live trail rendered in the UI — the step plus its outcome. */
export interface AgentTrailEntry {
  stepNumber: number;
  sql: string;
  reasoning: string;
  result: { rowCount: number; columns: string[] } | null; // null while the step is in flight
  errorMessage: string | null;
}

export type AgentPhase = "idle" | "thinking" | "executing" | "done" | "error";
