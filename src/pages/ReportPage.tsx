import { useState } from "react";
import { Download, FileText, Loader2, TriangleAlert } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useInsightsStore } from "@/store/insightsStore";
import { useTextToSqlStore } from "@/store/textToSqlStore";
import { useReportStore } from "@/store/reportStore";
import { exportReportPdf } from "@/lib/pdf/exportReportPdf";
import { Header } from "@/components/layout/Header";
import { NoDatasetState } from "@/components/shared/NoDatasetState";
import { ReportHeaderForm } from "@/components/report/ReportHeaderForm";
import { ReportBlockList } from "@/components/report/ReportBlockList";
import { ReportPreview } from "@/components/report/ReportPreview";
import { Button } from "@/components/ui/button";

export function ReportPage() {
  const dataset = useDatasetStore((s) => s.dataset);
  const charts = useDashboardStore((s) => s.charts);
  const kpis = useDashboardStore((s) => s.kpis);
  const insights = useInsightsStore((s) => s.insights);
  const queryHistory = useTextToSqlStore((s) => s.history);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!dataset) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const state = useReportStore.getState();
      await exportReportPdf({
        report: {
          title: state.title,
          subtitle: state.subtitle,
          date: state.date,
          logoDataUrl: state.logoDataUrl,
          blocks: state.blocks,
        },
        dataset,
        charts,
        kpis,
        insights,
        queryHistory,
      });
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "La génération du PDF a échoué. Réessayez."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {!dataset ? (
          <NoDatasetState
            icon={FileText}
            title="Aucune donnée pour générer un rapport"
            description="Le rapport assemble les graphiques et indicateurs déjà créés sur le tableau de bord. Retournez à la page de nettoyage pour importer un fichier."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-foreground">Rapport</h1>
                <p className="text-sm text-muted-foreground">
                  Assemblez un rapport à partir de vos graphiques et indicateurs, puis exportez-le en PDF.
                </p>
              </div>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
                {isExporting ? "Génération en cours…" : "Exporter en PDF"}
              </Button>
            </div>

            {exportError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {exportError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
              <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <ReportHeaderForm />
                <ReportBlockList />
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-4 sm:p-8">
                <ReportPreview dataset={dataset} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
