import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Dataset } from "@/types/dataset";

function toPlainRows(dataset: Dataset): Record<string, unknown>[] {
  const columnNames = dataset.columns.map((c) => c.name);
  return dataset.rows.map((row) => {
    const plain: Record<string, unknown> = {};
    for (const name of columnNames) {
      plain[name] = row[name] ?? "";
    }
    return plain;
  });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

export function exportDatasetAsCsv(dataset: Dataset) {
  const csv = Papa.unparse(toPlainRows(dataset), {
    columns: dataset.columns.map((c) => c.name),
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${baseName(dataset.fileName)}_nettoye.csv`);
}

export function exportDatasetAsXlsx(dataset: Dataset) {
  const worksheet = XLSX.utils.json_to_sheet(toPlainRows(dataset), {
    header: dataset.columns.map((c) => c.name),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Données nettoyées");
  const arrayBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  const blob = new Blob([arrayBuffer], {
    type: "application/octet-stream",
  });
  triggerDownload(blob, `${baseName(dataset.fileName)}_nettoye.xlsx`);
}
