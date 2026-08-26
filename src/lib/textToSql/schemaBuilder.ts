import type { Dataset } from "@/types/dataset";
import type { DatasetSchemaPayload } from "@/types/textToSql";
import { QUERY_TABLE_NAME } from "@/lib/duckdb/loadDataset";

const MAX_SAMPLE_VALUES = 3;

function collectSampleValues(dataset: Dataset, columnName: string): string[] {
  const seen = new Set<string>();
  for (const row of dataset.rows) {
    const value = row[columnName];
    if (value === null || value === "") continue;
    const text = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
    seen.add(text);
    if (seen.size >= MAX_SAMPLE_VALUES) break;
  }
  return [...seen];
}

/** Builds the schema payload (columns, types, example values) sent to /generate-sql and /fix-sql.
 * `tableName` defaults to the primary table; pass the secondary table's own
 * name to build its payload the same way. */
export function buildDatasetSchema(
  dataset: Dataset,
  tableName: string = QUERY_TABLE_NAME
): DatasetSchemaPayload {
  return {
    table_name: tableName,
    columns: dataset.columns.map((col) => ({
      name: col.name,
      type: col.type,
      sample_values: collectSampleValues(dataset, col.name),
    })),
  };
}

const MAX_EXAMPLES = 4;

/** Adapts example questions to the dataset's actual columns so they're always runnable, not generic filler. */
export function buildExampleQuestions(dataset: Dataset): string[] {
  const stringCol = dataset.columns.find((c) => c.type === "string")?.name;
  const numberCol = dataset.columns.find((c) => c.type === "number")?.name;
  const dateCol = dataset.columns.find((c) => c.type === "date")?.name;

  const examples: string[] = [];
  if (stringCol && numberCol) {
    examples.push(`Quelles sont les 5 ${stringCol} avec le plus de ${numberCol} ?`);
    examples.push(`Quelle est la moyenne de ${numberCol} par ${stringCol} ?`);
  }
  if (dateCol && numberCol) {
    examples.push(`Comment évolue ${numberCol} dans le temps ?`);
  }
  if (stringCol) {
    examples.push(`Quelles sont les valeurs les plus fréquentes de ${stringCol} ?`);
  }
  examples.push("Combien de lignes contient ce jeu de données ?");

  return examples.slice(0, MAX_EXAMPLES);
}
