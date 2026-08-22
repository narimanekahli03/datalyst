import Papa from "papaparse";
import * as XLSX from "xlsx";
import { nanoid } from "nanoid";
import type { CellValue, ColumnMeta, Dataset } from "@/types/dataset";
import { coerceValueToType, detectColumnType } from "@/lib/typeDetection";

export class FileParseError extends Error {}

const CSV_EXTENSIONS = [".csv"];
const EXCEL_EXTENSIONS = [".xlsx", ".xls"];

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

function normalizeCell(raw: unknown): CellValue {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  const text = String(raw);
  return text.trim() === "" ? "" : text;
}

function buildColumns(
  headers: string[],
  rows: Record<string, CellValue>[]
): ColumnMeta[] {
  return headers.map((name) => {
    const values = rows.map((row) => row[name] ?? null);
    return { name, type: detectColumnType(values) };
  });
}

/**
 * Type detection only *infers* a column's type from sampled strings — cell
 * values still need to be actually converted, or every numeric/date/boolean
 * column would silently behave as text (breaking aggregation, mean/median
 * fill, etc.) until the user manually ran "Convertir un type" on it.
 */
function coerceRowsToColumnTypes(
  rows: Record<string, CellValue>[],
  columns: ColumnMeta[]
): Record<string, CellValue>[] {
  return rows.map((row) => {
    const next: Record<string, CellValue> = { ...row };
    for (const column of columns) {
      next[column.name] = coerceValueToType(row[column.name] ?? null, column.type);
    }
    return next;
  });
}

function attachRowIds(
  rows: Record<string, CellValue>[]
): Dataset["rows"] {
  return rows.map((row) => ({ __rowId: nanoid(), ...row }));
}

function parseCsv(file: File): Promise<{
  headers: string[];
  rows: Record<string, CellValue>[];
}> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        const headers = (results.meta.fields ?? []).map((field) =>
          field.trim()
        );
        if (headers.length === 0) {
          reject(new FileParseError("Le fichier CSV ne contient aucune colonne."));
          return;
        }
        const rows = results.data.map((raw) => {
          const row: Record<string, CellValue> = {};
          for (const header of headers) {
            row[header] = normalizeCell(raw[header]);
          }
          return row;
        });
        resolve({ headers, rows });
      },
      error: (error: Error) => reject(new FileParseError(error.message)),
    });
  });
}

async function parseExcel(file: File): Promise<{
  headers: string[];
  rows: Record<string, CellValue>[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new FileParseError("Le classeur Excel ne contient aucune feuille.");
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (matrix.length === 0) {
    throw new FileParseError("La feuille Excel est vide.");
  }

  const headers = (matrix[0] as unknown[]).map((cell, index) => {
    const text = cell === null ? "" : String(cell).trim();
    return text === "" ? `Colonne ${index + 1}` : text;
  });

  const rows = matrix.slice(1).map((line) => {
    const row: Record<string, CellValue> = {};
    headers.forEach((header, index) => {
      row[header] = normalizeCell(line[index]);
    });
    return row;
  });

  return { headers, rows };
}

export async function parseFile(file: File): Promise<Dataset> {
  const extension = getExtension(file.name);

  let parsed: { headers: string[]; rows: Record<string, CellValue>[] };
  let fileType: Dataset["fileType"];

  if (CSV_EXTENSIONS.includes(extension)) {
    parsed = await parseCsv(file);
    fileType = "csv";
  } else if (EXCEL_EXTENSIONS.includes(extension)) {
    parsed = await parseExcel(file);
    fileType = "xlsx";
  } else {
    throw new FileParseError(
      "Format non supporté. Utilisez un fichier .csv, .xlsx ou .xls."
    );
  }

  if (parsed.rows.length === 0) {
    throw new FileParseError("Le fichier ne contient aucune ligne de données.");
  }

  const columns = buildColumns(parsed.headers, parsed.rows);
  const rows = attachRowIds(coerceRowsToColumnTypes(parsed.rows, columns));

  return {
    fileName: file.name,
    fileType,
    columns,
    rows,
  };
}
