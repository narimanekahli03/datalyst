import { pdf } from "@react-pdf/renderer";
import { toPng } from "html-to-image";
import type { ReportConfig } from "@/types/report";
import type { ChartConfig, KpiConfig } from "@/types/dashboard";
import type { Dataset } from "@/types/dataset";
import type { Insight } from "@/types/insights";
import type { TextToSqlHistoryEntry } from "@/types/textToSql";
import { ReportDocument, type ChartImageData } from "@/lib/pdf/ReportDocument";
import { chartBlockNodeId } from "@/components/report/ReportBlockPreview";

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

interface ExportReportPdfParams {
  report: ReportConfig;
  dataset: Dataset;
  charts: ChartConfig[];
  kpis: KpiConfig[];
  insights: Insight[];
  queryHistory: TextToSqlHistoryEntry[];
}

/**
 * Captures each chart block's already-rendered (light-forced) preview node
 * as a PNG, then hands everything to @react-pdf/renderer to build the
 * document. The capture has to happen first and separately — react-pdf's
 * render tree is synchronous, it can't wait on an async screenshot itself.
 */
export async function exportReportPdf({
  report,
  dataset,
  charts,
  kpis,
  insights,
  queryHistory,
}: ExportReportPdfParams) {
  const chartImages: Record<string, ChartImageData> = {};

  for (const block of report.blocks) {
    if (block.type !== "chart" || !block.chartId) continue;
    const node = document.getElementById(chartBlockNodeId(block.id));
    if (!node) continue;

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const dataUrl = await toPng(node, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      cacheBust: true,
      // The chart is captured in the same browser context that already has
      // the app's fonts loaded and applied — no need for html-to-image to
      // also try to inline @font-face rules (which fails loudly on the
      // cross-origin Google Fonts stylesheet and is purely cosmetic noise).
      skipFonts: true,
    });
    chartImages[block.id] = { dataUrl, aspectRatio: rect.width / rect.height };
  }

  const blob = await pdf(
    <ReportDocument
      report={report}
      dataset={dataset}
      charts={charts}
      kpis={kpis}
      insights={insights}
      queryHistory={queryHistory}
      chartImages={chartImages}
    />
  ).toBlob();

  const fileName = (report.title.trim() || "rapport").replace(/\s+/g, "_");
  triggerDownload(blob, `${fileName}.pdf`);
}
