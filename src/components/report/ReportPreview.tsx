import { useReportStore } from "@/store/reportStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useInsightsStore } from "@/store/insightsStore";
import { useTextToSqlStore } from "@/store/textToSqlStore";
import type { Dataset } from "@/types/dataset";
import { ReportBlockPreview } from "@/components/report/ReportBlockPreview";

interface ReportPreviewProps {
  dataset: Dataset;
}

function formatReportDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    date
  );
}

/**
 * A fixed white "paper" surface — deliberately ignores the app's current
 * light/dark theme, since it exists to preview the (always white) exported
 * PDF rather than to match the app chrome. Chart blocks render with
 * `forceLight` for the same reason.
 */
export function ReportPreview({ dataset }: ReportPreviewProps) {
  const title = useReportStore((s) => s.title);
  const subtitle = useReportStore((s) => s.subtitle);
  const date = useReportStore((s) => s.date);
  const logoDataUrl = useReportStore((s) => s.logoDataUrl);
  const blocks = useReportStore((s) => s.blocks);
  const charts = useDashboardStore((s) => s.charts);
  const kpis = useDashboardStore((s) => s.kpis);
  const insights = useInsightsStore((s) => s.insights);
  const queryHistory = useTextToSqlStore((s) => s.history);

  return (
    <div className="mx-auto w-full max-w-[820px] rounded-xl border border-[#e1e0d9] bg-white shadow-elevated">
      <div className="px-10 py-10 sm:px-14 sm:py-12">
        <div className="mb-8 flex items-start justify-between gap-6 border-b border-[#e1e0d9] pb-6">
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-[#0b0b0b]">{title || "Rapport d'analyse"}</h1>
            {subtitle && <p className="mt-1 text-base text-[#52514e]">{subtitle}</p>}
            <p className="mt-2 text-xs text-[#898781]">{formatReportDate(date)}</p>
          </div>
          {logoDataUrl && (
            <img src={logoDataUrl} alt="Logo" className="h-14 w-14 shrink-0 rounded object-contain" />
          )}
        </div>

        {blocks.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#898781]">
            Ajoutez des blocs depuis le panneau de gauche pour construire votre rapport.
          </p>
        ) : (
          <div className="space-y-6">
            {blocks.map((block) => (
              <ReportBlockPreview
                key={block.id}
                block={block}
                dataset={dataset}
                charts={charts}
                kpis={kpis}
                insights={insights}
                queryHistory={queryHistory}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-[#e1e0d9] pt-3 text-[10px] text-[#898781]">
          <span>Généré avec Data Cleaning Studio</span>
          <span>Page 1</span>
        </div>
      </div>
    </div>
  );
}
