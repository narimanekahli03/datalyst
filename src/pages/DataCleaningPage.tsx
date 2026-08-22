import { TriangleAlert, X } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/upload/EmptyState";
import { SummaryPanel } from "@/components/summary/SummaryPanel";
import { DataTable } from "@/components/data-table/DataTable";
import { CleaningToolbar } from "@/components/cleaning/CleaningToolbar";
import { OperationHistory } from "@/components/cleaning/OperationHistory";
import { InsightsPanel } from "@/components/insights/InsightsPanel";
import { cn } from "@/lib/utils";

export function DataCleaningPage() {
  const status = useDatasetStore((s) => s.status);
  const dataset = useDatasetStore((s) => s.dataset);
  const errorMessage = useDatasetStore((s) => s.errorMessage);
  const loadFile = useDatasetStore((s) => s.loadFile);
  const dismissError = useDatasetStore((s) => s.dismissError);

  const isReady = status === "ready" && dataset;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main
        className={cn(
          "mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8",
          isReady ? "pt-8" : "pt-0"
        )}
      >
        {isReady ? (
          <div className="space-y-6">
            <InsightsPanel dataset={dataset} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <div className="min-w-0 space-y-4">
                <CleaningToolbar />
                <DataTable dataset={dataset} />
              </div>
              <div className="space-y-4">
                <SummaryPanel dataset={dataset} />
                <OperationHistory />
              </div>
            </div>
          </div>
        ) : (
          <div>
            {status === "error" && errorMessage && (
              <div
                role="alert"
                className="mx-auto mt-8 flex max-w-2xl items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive shadow-soft"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="flex-1">{errorMessage}</p>
                <button
                  onClick={dismissError}
                  className="rounded-sm opacity-70 hover:opacity-100"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <EmptyState onFileSelected={loadFile} isLoading={status === "loading"} />
          </div>
        )}
      </main>
    </div>
  );
}
