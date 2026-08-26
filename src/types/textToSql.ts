import type { CellValue, ColumnType } from "@/types/dataset";

/** One column's shape, sent to the backend as grounding context for SQL generation. */
export interface ColumnSchemaPayload {
  name: string;
  type: ColumnType;
  sample_values: string[];
}

export interface DatasetSchemaPayload {
  table_name: string;
  columns: ColumnSchemaPayload[];
}

export interface GenerateSqlRequest {
  question: string;
  schema: DatasetSchemaPayload;
  /** A second table joined on the query page, if any — lets the AI write JOINs. */
  secondary_tables?: DatasetSchemaPayload[];
}

export interface GenerateSqlResponse {
  sql: string;
  explanation: string;
}

export interface FixSqlRequest {
  question: string;
  sql: string;
  error_message: string;
  schema: DatasetSchemaPayload;
  secondary_tables?: DatasetSchemaPayload[];
}

/** Same shape as a fresh generation: a corrected query plus its explanation. */
export type FixSqlResponse = GenerateSqlResponse;

export interface SummarizeRequest {
  question: string;
  sql: string;
  columns: string[];
  rows: Record<string, CellValue>[];
  row_count: number;
  truncated: boolean;
}

export interface SummarizeResponse {
  summary: string;
}

/** Result of running a generated query against the local DuckDB-WASM instance. */
export interface QueryResult {
  columns: string[];
  rows: Record<string, CellValue>[];
}

export type QueryPhase =
  | "idle"
  | "generating"
  | "executing"
  | "fixing"
  | "summarizing"
  | "done"
  | "error";

export type DuckDbStatus = "idle" | "initializing" | "ready" | "error";

export interface TextToSqlHistoryEntry {
  id: string;
  question: string;
  sql: string;
  explanation: string;
  result: QueryResult;
  summary: string;
  timestamp: number;
}
