import type { CellValue, Dataset } from "@/types/dataset";
import type { AggregationType, ChartConfig, ChartRenderData, ChartSeriesMeta, KpiConfig } from "@/types/dashboard";
import { getCategoricalPalette, MAX_SERIES, OTHER_LABEL } from "@/lib/chartPalette";

function toNumber(value: CellValue): number | null {
  return typeof value === "number" ? value : null;
}

function stringifyKey(value: CellValue): string {
  if (value === null || value === "") return "Non renseigné";
  if (typeof value === "boolean") return value ? "Vrai" : "Faux";
  return String(value);
}

/**
 * Returns null when there is nothing to aggregate — a category/group
 * combination with zero contributing rows has no meaningful value, and
 * charting it as 0 would draw a misleading dip (especially on line charts).
 * "count" is the one exception: 0 occurrences is itself real information.
 */
export function aggregateValues(values: number[], type: AggregationType): number | null {
  if (values.length === 0) return type === "count" ? 0 : null;
  switch (type) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "count":
      return values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}

function groupRowsByKey(rows: Dataset["rows"], field: string): Map<string, Dataset["rows"]> {
  const map = new Map<string, Dataset["rows"]>();
  for (const row of rows) {
    const key = stringifyKey(row[field]);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function missingColumnsFor(dataset: Dataset, fields: (string | null | undefined)[]): string[] {
  const names = new Set(dataset.columns.map((c) => c.name));
  return fields.filter((f): f is string => !!f && !names.has(f));
}

function emptyResult(xKey: string, missingColumns: string[] = []): ChartRenderData {
  return { data: [], series: [], xKey, isEmpty: true, missingColumns };
}

function buildCartesianData(dataset: Dataset, config: ChartConfig, isDark: boolean): ChartRenderData {
  const { xField, yFields, aggregation, groupByField } = config;
  if (!xField || yFields.length === 0) return emptyResult("x");

  const missingColumns = missingColumnsFor(dataset, [xField, ...yFields, groupByField]);
  if (missingColumns.length > 0) return emptyResult(xField, missingColumns);

  const palette = getCategoricalPalette(isDark);
  const xGroups = groupRowsByKey(dataset.rows, xField);

  if (groupByField && yFields.length === 1) {
    const yField = yFields[0];

    const groupTotals = new Map<string, number>();
    for (const row of dataset.rows) {
      const value = toNumber(row[yField]);
      if (value === null) continue;
      const key = stringifyKey(row[groupByField]);
      groupTotals.set(key, (groupTotals.get(key) ?? 0) + value);
    }
    const sortedGroups = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const overflow = sortedGroups.length > MAX_SERIES;
    const topGroups = overflow ? sortedGroups.slice(0, MAX_SERIES - 1) : sortedGroups;
    const seriesKeys = overflow ? [...topGroups, OTHER_LABEL] : topGroups;

    const data = [...xGroups.entries()].map(([xKey, rows]) => {
      const point: Record<string, string | number | null> = { [xField]: xKey };
      for (const seriesKey of seriesKeys) {
        const subset = rows.filter((r) => {
          const g = stringifyKey(r[groupByField]);
          return seriesKey === OTHER_LABEL ? !topGroups.includes(g) : g === seriesKey;
        });
        const values = subset.map((r) => toNumber(r[yField])).filter((v): v is number => v !== null);
        point[seriesKey] = aggregateValues(values, aggregation);
      }
      return point;
    });

    const series: ChartSeriesMeta[] = seriesKeys.map((key, i) => ({
      key,
      label: key,
      color: palette[i % palette.length],
    }));
    return { data, series, xKey: xField, isEmpty: data.length === 0, missingColumns: [] };
  }

  const data = [...xGroups.entries()].map(([xKey, rows]) => {
    const point: Record<string, string | number | null> = { [xField]: xKey };
    for (const yField of yFields) {
      const values = rows.map((r) => toNumber(r[yField])).filter((v): v is number => v !== null);
      point[yField] = aggregateValues(values, aggregation);
    }
    return point;
  });

  const series: ChartSeriesMeta[] = yFields.map((f, i) => ({
    key: f,
    label: f,
    color: palette[i % palette.length],
  }));
  return { data, series, xKey: xField, isEmpty: data.length === 0, missingColumns: [] };
}

function buildPieData(dataset: Dataset, config: ChartConfig, isDark: boolean): ChartRenderData {
  const { xField, yFields, aggregation } = config;
  const yField = yFields[0];
  if (!xField || !yField) return emptyResult("name");

  const missingColumns = missingColumnsFor(dataset, [xField, yField]);
  if (missingColumns.length > 0) return emptyResult("name", missingColumns);

  const groups = groupRowsByKey(dataset.rows, xField);
  const entries = [...groups.entries()]
    .map(([name, rows]) => {
      const values = rows.map((r) => toNumber(r[yField])).filter((v): v is number => v !== null);
      // A pie slice can't be "no data" — an empty group contributes 0 to the whole.
      return { name, value: aggregateValues(values, aggregation) ?? 0 };
    })
    .sort((a, b) => b.value - a.value);

  const overflow = entries.length > MAX_SERIES;
  const finalEntries = overflow
    ? [
        ...entries.slice(0, MAX_SERIES - 1),
        {
          name: OTHER_LABEL,
          value: entries.slice(MAX_SERIES - 1).reduce((sum, e) => sum + e.value, 0),
        },
      ]
    : entries;

  const palette = getCategoricalPalette(isDark);
  const series: ChartSeriesMeta[] = finalEntries.map((e, i) => ({
    key: e.name,
    label: e.name,
    color: palette[i % palette.length],
  }));

  return {
    data: finalEntries,
    series,
    xKey: "name",
    isEmpty: finalEntries.length === 0,
    missingColumns: [],
  };
}

function buildScatterData(dataset: Dataset, config: ChartConfig, isDark: boolean): ChartRenderData {
  const { xField, yFields, groupByField } = config;
  const yField = yFields[0];
  if (!xField || !yField) return emptyResult("x");

  const missingColumns = missingColumnsFor(dataset, [xField, yField, groupByField]);
  if (missingColumns.length > 0) return emptyResult("x", missingColumns);

  const palette = getCategoricalPalette(isDark);

  if (groupByField) {
    const counts = new Map<string, number>();
    for (const row of dataset.rows) {
      const key = stringifyKey(row[groupByField]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sortedGroups = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    const overflow = sortedGroups.length > MAX_SERIES;
    const topGroups = overflow ? sortedGroups.slice(0, MAX_SERIES - 1) : sortedGroups;
    const seriesKeys = overflow ? [...topGroups, OTHER_LABEL] : topGroups;

    const data: Record<string, string | number>[] = [];
    for (const row of dataset.rows) {
      const x = toNumber(row[xField]);
      const y = toNumber(row[yField]);
      if (x === null || y === null) continue;
      const g = stringifyKey(row[groupByField]);
      data.push({ x, y, series: topGroups.includes(g) ? g : OTHER_LABEL });
    }

    const series: ChartSeriesMeta[] = seriesKeys.map((key, i) => ({
      key,
      label: key,
      color: palette[i % palette.length],
    }));
    return { data, series, xKey: "x", isEmpty: data.length === 0, missingColumns: [] };
  }

  const data: Record<string, string | number>[] = [];
  for (const row of dataset.rows) {
    const x = toNumber(row[xField]);
    const y = toNumber(row[yField]);
    if (x === null || y === null) continue;
    data.push({ x, y, series: yField });
  }
  const series: ChartSeriesMeta[] = [{ key: yField, label: yField, color: palette[0] }];
  return { data, series, xKey: "x", isEmpty: data.length === 0, missingColumns: [] };
}

export function buildChartData(dataset: Dataset, config: ChartConfig, isDark: boolean): ChartRenderData {
  if (config.type === "pie") return buildPieData(dataset, config, isDark);
  if (config.type === "scatter") return buildScatterData(dataset, config, isDark);
  return buildCartesianData(dataset, config, isDark);
}

export function computeKpiValue(dataset: Dataset, kpi: KpiConfig): number | null {
  if (kpi.field === null) return dataset.rows.length;
  const values = dataset.rows
    .map((r) => toNumber(r[kpi.field as string]))
    .filter((v): v is number => v !== null);
  return aggregateValues(values, kpi.aggregation);
}

export function isKpiFieldMissing(dataset: Dataset, kpi: KpiConfig): boolean {
  if (kpi.field === null) return false;
  return !dataset.columns.some((c) => c.name === kpi.field);
}
