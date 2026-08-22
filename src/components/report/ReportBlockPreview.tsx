import { AlertCircle } from "lucide-react";
import type { ReportBlock } from "@/types/report";
import type { Dataset } from "@/types/dataset";
import type { ChartConfig, KpiConfig } from "@/types/dashboard";
import type { Insight } from "@/types/insights";
import type { TextToSqlHistoryEntry } from "@/types/textToSql";
import { computeKpiValue, isKpiFieldMissing } from "@/lib/chartData";
import { formatCellValue } from "@/lib/columnTypeMeta";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";

/** DOM id used by the PDF export pipeline to locate and capture this chart block. */
export function chartBlockNodeId(blockId: string): string {
  return `report-chart-node-${blockId}`;
}

interface ReportBlockPreviewProps {
  block: ReportBlock;
  dataset: Dataset;
  charts: ChartConfig[];
  kpis: KpiConfig[];
  insights: Insight[];
  queryHistory: TextToSqlHistoryEntry[];
}

/** Row/column caps for an embedded query result — reports stay compact, results here are usually small aggregates anyway. */
const QUERY_BLOCK_MAX_ROWS = 10;
const QUERY_BLOCK_MAX_COLUMNS = 8;

function PlaceholderNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-sm text-[#898781]">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

export function ReportBlockPreview({
  block,
  dataset,
  charts,
  kpis,
  insights,
  queryHistory,
}: ReportBlockPreviewProps) {
  if (block.type === "text") {
    if (!block.heading && !block.content) {
      return <PlaceholderNote message="Bloc de texte vide. Ajoutez un titre ou un contenu." />;
    }
    return (
      <div className="space-y-1.5">
        {block.heading && <h3 className="text-base font-semibold text-[#0b0b0b]">{block.heading}</h3>}
        {block.content && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[#52514e]">{block.content}</p>
        )}
      </div>
    );
  }

  if (block.type === "chart") {
    const chart = charts.find((c) => c.id === block.chartId);
    if (!chart) {
      return <PlaceholderNote message="Aucun graphique sélectionné pour ce bloc." />;
    }
    return (
      <div id={chartBlockNodeId(block.id)} className="rounded-lg border border-[#e1e0d9] bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[#0b0b0b]">{chart.title}</p>
        <ChartRenderer config={chart} dataset={dataset} forceLight />
      </div>
    );
  }

  if (block.type === "kpi") {
    if (kpis.length === 0) {
      return <PlaceholderNote message="Aucun indicateur configuré sur le tableau de bord." />;
    }
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const missing = isKpiFieldMissing(dataset, kpi);
          const value = missing ? null : computeKpiValue(dataset, kpi);
          return (
            <div key={kpi.id} className="rounded-lg border border-[#e1e0d9] bg-white px-3 py-3 text-center">
              <p className="font-display text-lg text-[#0b0b0b]">
                {value === null ? "-" : formatCompactNumber(value)}
              </p>
              <p className="truncate text-[11px] text-[#898781]">{kpi.label}</p>
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === "insights") {
    if (insights.length === 0) {
      return (
        <PlaceholderNote message="Aucun insight IA disponible. Générez-les depuis la page Nettoyage." />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="rounded-lg border border-[#e1e0d9] bg-white px-3 py-2.5 text-sm text-[#52514e]"
          >
            {insight.text}
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "query") {
    const entry = queryHistory.find((h) => h.id === block.queryEntryId);
    if (!entry) {
      return <PlaceholderNote message="Aucune question sélectionnée pour ce bloc." />;
    }
    const columns = entry.result.columns.slice(0, QUERY_BLOCK_MAX_COLUMNS);
    const rows = entry.result.rows.slice(0, QUERY_BLOCK_MAX_ROWS);
    return (
      <div className="space-y-2.5">
        <h3 className="text-base font-semibold text-[#0b0b0b]">{entry.question}</h3>
        <p className="text-sm leading-relaxed text-[#52514e]">{entry.summary}</p>
        <pre className="overflow-x-auto rounded-md border border-[#e1e0d9] bg-[#f0efec] px-3 py-2 font-mono text-[11px] text-[#0b0b0b]">
          {entry.sql}
        </pre>
        <div className="overflow-hidden rounded-lg border border-[#e1e0d9]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#f0efec]">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-[#e1e0d9] px-2.5 py-2 text-left font-semibold text-[#0b0b0b]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[#e1e0d9] last:border-0">
                  {columns.map((col) => (
                    <td key={col} className="px-2.5 py-1.5 text-[#52514e]">
                      {formatCellValue(row[col] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // table
  const columns = dataset.columns.slice(0, 8);
  const rows = dataset.rows.slice(0, block.maxRows);
  const truncatedColumns = dataset.columns.length > columns.length;

  return (
    <div className="overflow-hidden rounded-lg border border-[#e1e0d9]">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-[#f0efec]">
            {columns.map((col) => (
              <th key={col.name} className="border-b border-[#e1e0d9] px-2.5 py-2 text-left font-semibold text-[#0b0b0b]">
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.__rowId} className="border-b border-[#e1e0d9] last:border-0">
              {columns.map((col) => (
                <td key={col.name} className="px-2.5 py-1.5 text-[#52514e]">
                  {formatCellValue(row[col.name] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[#e1e0d9] bg-[#f9f9f7] px-2.5 py-1.5 text-[11px] text-[#898781]">
        {formatNumber(rows.length)} sur {formatNumber(dataset.rows.length)} ligne(s) affichée(s)
        {truncatedColumns ? ` · ${formatNumber(columns.length)} sur ${formatNumber(dataset.columns.length)} colonnes` : ""}
      </p>
    </div>
  );
}
