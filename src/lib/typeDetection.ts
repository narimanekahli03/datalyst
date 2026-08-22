import type { CellValue, ColumnType } from "@/types/dataset";

const SAMPLE_SIZE = 200;
const MATCH_THRESHOLD = 0.8;

const BOOLEAN_PATTERN = /^(true|false|oui|non|yes|no|vrai|faux)$/i;
const NUMBER_PATTERN = /^-?\d+([.,]\d+)?$/;
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/, // ISO
  /^\d{2}\/\d{2}\/\d{4}$/, // dd/mm/yyyy or mm/dd/yyyy
  /^\d{2}-\d{2}-\d{4}$/,
];

function classifyValue(value: CellValue): ColumnType {
  if (value === null) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";

  const trimmed = value.trim();
  if (trimmed === "") return "string";
  if (BOOLEAN_PATTERN.test(trimmed)) return "boolean";
  if (NUMBER_PATTERN.test(trimmed)) return "number";
  if (DATE_PATTERNS.some((pattern) => pattern.test(trimmed))) return "date";
  return "string";
}

/**
 * Infers a column's dominant type by sampling up to SAMPLE_SIZE non-null
 * values and taking the majority classification, provided it clears
 * MATCH_THRESHOLD. Falls back to "string" when values are too mixed.
 */
export function detectColumnType(values: CellValue[]): ColumnType {
  const sample: CellValue[] = [];
  for (const value of values) {
    if (value === null || value === "") continue;
    sample.push(value);
    if (sample.length >= SAMPLE_SIZE) break;
  }

  if (sample.length === 0) return "string";

  const counts: Record<ColumnType, number> = {
    string: 0,
    number: 0,
    date: 0,
    boolean: 0,
  };

  for (const value of sample) {
    counts[classifyValue(value)] += 1;
  }

  let bestType: ColumnType = "string";
  let bestCount = 0;
  for (const type of Object.keys(counts) as ColumnType[]) {
    if (counts[type] > bestCount) {
      bestType = type;
      bestCount = counts[type];
    }
  }

  const ratio = bestCount / sample.length;
  return ratio >= MATCH_THRESHOLD ? bestType : "string";
}

export function coerceValueToType(
  value: CellValue,
  type: ColumnType
): CellValue {
  if (value === null) return null;

  if (type === "string") {
    return typeof value === "string" ? value : String(value);
  }

  if (type === "number") {
    if (typeof value === "number") return value;
    const normalized = String(value).trim().replace(",", ".");
    if (normalized === "" || !NUMBER_PATTERN.test(String(value).trim())) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (["true", "yes", "oui", "vrai", "1"].includes(normalized)) return true;
    if (["false", "no", "non", "faux", "0"].includes(normalized)) return false;
    return null;
  }

  if (type === "date") {
    const raw = (typeof value === "string" ? value : String(value)).trim();

    // dd/mm/yyyy or dd-mm-yyyy: parsed explicitly as day/month/year (French
    // convention) rather than via Date.parse, which reads ambiguous
    // slash-dates as US mm/dd/yyyy.
    const explicitMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (explicitMatch) {
      const [, day, month, year] = explicitMatch;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      const isValid =
        !Number.isNaN(date.getTime()) && date.getUTCMonth() === Number(month) - 1;
      return isValid ? date.toISOString().slice(0, 10) : null;
    }

    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return value;
}
