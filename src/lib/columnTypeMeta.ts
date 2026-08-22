import type { CellValue, ColumnType } from "@/types/dataset";

export const TYPE_LABELS: Record<ColumnType, string> = {
  string: "Texte",
  number: "Nombre",
  date: "Date",
  boolean: "Booléen",
};

/** Dot color per column type — identity encoding, always paired with the text label. */
export const TYPE_DOT: Record<ColumnType, string> = {
  string: "bg-muted-foreground",
  number: "bg-accent",
  date: "bg-success",
  boolean: "bg-[hsl(280_60%_58%)]",
};

export function formatCellValue(value: CellValue): string {
  if (value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Vrai" : "Faux";
  return String(value);
}
