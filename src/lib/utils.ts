import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;
}

/** Compact form for large stat values: 1 284 -> "1,3 k", 12900000 -> "12,9 M". */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Fixed-precision decimal for statistical values (mean, std dev, quartiles…). */
export function formatDecimal(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(value);
}

/** Rough human-readable byte size, e.g. 128000 -> "125 Ko". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${formatDecimal(value, 1)} ${units[unitIndex]}`;
}
