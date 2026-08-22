import type { CellValue, ColumnType, Dataset } from "@/types/dataset";
import type { QueryResult } from "@/types/textToSql";
import { getDuckDbConnection, getDuckDbEngine } from "@/lib/duckdb/duckdbClient";

/** Name of the SQL table the loaded dataset is exposed as — part of the schema sent to the backend. */
export const QUERY_TABLE_NAME = "data";

const STAGING_TABLE_NAME = "__data_staging";
const STAGING_FILE_NAME = "dataset_rows.json";

const DUCKDB_TYPE_BY_COLUMN_TYPE: Record<ColumnType, string> = {
  string: "VARCHAR",
  number: "DOUBLE",
  date: "DATE",
  boolean: "BOOLEAN",
};

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Loads the current Zustand dataset into DuckDB-WASM as the `data` table.
 *
 * Rows are inserted via DuckDB's own JSON reader (fast, no per-row loop) into
 * a staging table, then copied into the final table through an explicit
 * TRY_CAST per column so the SQL types match `ColumnMeta.type` exactly,
 * regardless of what DuckDB's JSON type inference guessed. TRY_CAST (not
 * CAST) so a single malformed cell nulls out instead of failing the whole load.
 */
export async function loadDatasetIntoDuckDB(dataset: Dataset): Promise<void> {
  const db = await getDuckDbEngine();
  const conn = await getDuckDbConnection();

  const jsonRows = dataset.rows.map((row) => {
    const record: Record<string, CellValue> = {};
    for (const col of dataset.columns) record[col.name] = row[col.name] ?? null;
    return record;
  });

  await db.registerFileText(STAGING_FILE_NAME, JSON.stringify(jsonRows));
  await conn.query(`DROP TABLE IF EXISTS ${quoteIdentifier(QUERY_TABLE_NAME)}`);
  await conn.query(`DROP TABLE IF EXISTS ${quoteIdentifier(STAGING_TABLE_NAME)}`);
  await conn.insertJSONFromPath(STAGING_FILE_NAME, { name: STAGING_TABLE_NAME });

  const selectColumns = dataset.columns
    .map((col) => {
      const quoted = quoteIdentifier(col.name);
      const duckType = DUCKDB_TYPE_BY_COLUMN_TYPE[col.type];
      return `TRY_CAST(${quoted} AS ${duckType}) AS ${quoted}`;
    })
    .join(", ");

  await conn.query(
    `CREATE TABLE ${quoteIdentifier(QUERY_TABLE_NAME)} AS SELECT ${selectColumns || "*"} FROM ${quoteIdentifier(STAGING_TABLE_NAME)}`
  );
  await conn.query(`DROP TABLE ${quoteIdentifier(STAGING_TABLE_NAME)}`);
  await db.dropFile(STAGING_FILE_NAME);
}

/** Thrown when a query still fails after every auto-correction attempt was exhausted. */
export class ExecutionFailedError extends Error {}

function normalizeArrowValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

/** Runs SQL against the loaded `data` table and returns plain-JS columns/rows. */
export async function runQuery(sql: string): Promise<QueryResult> {
  const conn = await getDuckDbConnection();
  let table;
  try {
    table = await conn.query(sql);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }

  const columns = table.schema.fields.map((field) => field.name);
  const rows = table.toArray().map((row) => {
    const json = (row as { toJSON: () => Record<string, unknown> }).toJSON();
    const normalized: Record<string, CellValue> = {};
    for (const col of columns) normalized[col] = normalizeArrowValue(json[col]);
    return normalized;
  });

  return { columns, rows };
}
