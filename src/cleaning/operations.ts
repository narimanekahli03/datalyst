import type {
  ColumnType,
  Dataset,
  DataRow,
  MissingValueStrategy,
  OperationResult,
} from "@/types/dataset";
import { coerceValueToType, detectColumnType } from "@/lib/typeDetection";

export interface OperationOutput {
  dataset: Dataset;
  result: OperationResult;
}

const ALL_COLUMNS = "__all__";

function isMissing(value: unknown): boolean {
  return value === null || value === "";
}

function cloneRows(rows: DataRow[]): DataRow[] {
  return rows.map((row) => ({ ...row }));
}

function targetColumnNames(dataset: Dataset, columnName: string): string[] {
  return columnName === ALL_COLUMNS
    ? dataset.columns.map((c) => c.name)
    : [columnName];
}

/** Removes rows that duplicate an earlier row across all data columns. */
export function removeDuplicateRows(dataset: Dataset): OperationOutput {
  const columnNames = dataset.columns.map((c) => c.name);
  const seen = new Set<string>();
  const kept: DataRow[] = [];
  let removed = 0;

  for (const row of dataset.rows) {
    const signature = JSON.stringify(columnNames.map((name) => row[name] ?? null));
    if (seen.has(signature)) {
      removed += 1;
    } else {
      seen.add(signature);
      kept.push(row);
    }
  }

  return {
    dataset: { ...dataset, rows: kept },
    result: {
      label: "Doublons supprimés",
      detail:
        removed === 0
          ? "Aucun doublon trouvé."
          : `${removed} ligne(s) en double supprimée(s).`,
      affectedCount: removed,
    },
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function handleMissingValues(
  dataset: Dataset,
  columnName: string,
  strategy: MissingValueStrategy,
  fillValue?: string
): OperationOutput {
  const columns = targetColumnNames(dataset, columnName);
  const columnTypeByName = new Map(dataset.columns.map((c) => [c.name, c.type]));

  if (strategy === "drop-row") {
    let removed = 0;
    const kept = dataset.rows.filter((row) => {
      const hasMissing = columns.some((name) => isMissing(row[name]));
      if (hasMissing) removed += 1;
      return !hasMissing;
    });
    return {
      dataset: { ...dataset, rows: kept },
      result: {
        label: "Lignes avec valeurs manquantes supprimées",
        detail:
          removed === 0
            ? "Aucune ligne concernée."
            : `${removed} ligne(s) supprimée(s).`,
        affectedCount: removed,
      },
    };
  }

  if (strategy === "fill-mean" || strategy === "fill-median") {
    const numericColumns = columns.filter(
      (name) => columnTypeByName.get(name) === "number"
    );
    const fillByColumn = new Map<string, number>();
    for (const name of numericColumns) {
      const values = dataset.rows
        .map((row) => row[name])
        .filter((v): v is number => typeof v === "number");
      if (values.length === 0) continue;
      fillByColumn.set(name, strategy === "fill-mean" ? mean(values) : median(values));
    }

    let affected = 0;
    const rows = cloneRows(dataset.rows).map((row) => {
      for (const name of numericColumns) {
        if (isMissing(row[name]) && fillByColumn.has(name)) {
          row[name] = fillByColumn.get(name)!;
          affected += 1;
        }
      }
      return row;
    });

    const skippedNonNumeric = columns.length - numericColumns.length;
    return {
      dataset: { ...dataset, rows },
      result: {
        label:
          strategy === "fill-mean"
            ? "Valeurs manquantes remplacées par la moyenne"
            : "Valeurs manquantes remplacées par la médiane",
        detail:
          affected === 0
            ? "Aucune valeur numérique manquante à remplacer."
            : `${affected} valeur(s) remplacée(s).` +
              (skippedNonNumeric > 0
                ? ` (${skippedNonNumeric} colonne(s) non numérique(s) ignorée(s))`
                : ""),
        affectedCount: affected,
      },
    };
  }

  // fill-value
  let affected = 0;
  const rows = cloneRows(dataset.rows).map((row) => {
    for (const name of columns) {
      if (isMissing(row[name])) {
        const type = columnTypeByName.get(name) ?? "string";
        row[name] = coerceValueToType(fillValue ?? "", type) ?? fillValue ?? "";
        affected += 1;
      }
    }
    return row;
  });

  return {
    dataset: { ...dataset, rows },
    result: {
      label: "Valeurs manquantes remplacées",
      detail:
        affected === 0
          ? "Aucune valeur manquante à remplacer."
          : `${affected} valeur(s) remplacée(s) par "${fillValue}".`,
      affectedCount: affected,
    },
  };
}

export function trimWhitespace(
  dataset: Dataset,
  columnName: string
): OperationOutput {
  const columns = targetColumnNames(dataset, columnName).filter((name) => {
    const type = dataset.columns.find((c) => c.name === name)?.type;
    return type === "string" || type === undefined;
  });

  let affected = 0;
  const rows = cloneRows(dataset.rows).map((row) => {
    for (const name of columns) {
      const value = row[name];
      if (typeof value === "string") {
        const cleaned = value.trim().replace(/\s+/g, " ");
        if (cleaned !== value) {
          row[name] = cleaned;
          affected += 1;
        }
      }
    }
    return row;
  });

  return {
    dataset: { ...dataset, rows },
    result: {
      label: "Espaces superflus supprimés",
      detail:
        affected === 0
          ? "Aucun espace superflu trouvé."
          : `${affected} valeur(s) nettoyée(s).`,
      affectedCount: affected,
    },
  };
}

export function convertColumnType(
  dataset: Dataset,
  columnName: string,
  newType: ColumnType
): OperationOutput {
  let affected = 0;
  let failed = 0;
  const rows = cloneRows(dataset.rows).map((row) => {
    const original = row[columnName];
    if (!isMissing(original)) {
      const converted = coerceValueToType(original, newType);
      if (converted === null) failed += 1;
      if (converted !== original) affected += 1;
      row[columnName] = converted;
    }
    return row;
  });

  const columns = dataset.columns.map((col) =>
    col.name === columnName ? { ...col, type: newType } : col
  );

  return {
    dataset: { ...dataset, columns, rows },
    result: {
      label: `Colonne "${columnName}" convertie`,
      detail:
        failed > 0
          ? `${affected} valeur(s) convertie(s), ${failed} valeur(s) invalide(s) devenue(s) vide(s).`
          : `${affected} valeur(s) convertie(s) en ${newType}.`,
      affectedCount: affected,
    },
  };
}

export function renameColumn(
  dataset: Dataset,
  oldName: string,
  newName: string
): OperationOutput {
  const trimmedName = newName.trim();
  if (trimmedName === "" || trimmedName === oldName) {
    return {
      dataset,
      result: {
        label: "Renommage ignoré",
        detail: "Le nouveau nom est vide ou identique.",
        affectedCount: 0,
      },
    };
  }
  if (dataset.columns.some((c) => c.name === trimmedName)) {
    throw new Error(`Une colonne nommée "${trimmedName}" existe déjà.`);
  }

  const columns = dataset.columns.map((col) =>
    col.name === oldName ? { ...col, name: trimmedName } : col
  );

  const rows = dataset.rows.map((row) => {
    const { [oldName]: value, ...rest } = row;
    return { ...rest, [trimmedName]: value } as DataRow;
  });

  return {
    dataset: { ...dataset, columns, rows },
    result: {
      label: "Colonne renommée",
      detail: `"${oldName}" renommée en "${trimmedName}".`,
      affectedCount: dataset.rows.length,
    },
  };
}

export function deleteColumn(
  dataset: Dataset,
  columnName: string
): OperationOutput {
  const columns = dataset.columns.filter((c) => c.name !== columnName);
  const rows = dataset.rows.map((row) => {
    const { [columnName]: _removed, ...rest } = row;
    return rest as DataRow;
  });

  return {
    dataset: { ...dataset, columns, rows },
    result: {
      label: "Colonne supprimée",
      detail: `Colonne "${columnName}" supprimée.`,
      affectedCount: dataset.rows.length,
    },
  };
}

/** Re-runs type detection for every column, used after structural edits. */
export function redetectTypes(dataset: Dataset): Dataset {
  const columns = dataset.columns.map((col) => ({
    ...col,
    type: detectColumnType(dataset.rows.map((row) => row[col.name] ?? null)),
  }));
  return { ...dataset, columns };
}

export const ALL_COLUMNS_VALUE = ALL_COLUMNS;
