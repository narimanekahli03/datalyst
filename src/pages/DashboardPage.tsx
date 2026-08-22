import { useEffect, useState } from "react";
import { Plus, Table2, LayoutGrid } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { Header } from "@/components/layout/Header";
import { KpiRow } from "@/components/dashboard/KpiRow";
import { ChartBuilderPanel } from "@/components/dashboard/ChartBuilderPanel";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { EmptyDashboard } from "@/components/dashboard/DashboardEmptyStates";
import { NoDatasetState } from "@/components/shared/NoDatasetState";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const dataset = useDatasetStore((s) => s.dataset);
  const charts = useDashboardStore((s) => s.charts);
  const viewMode = useDashboardStore((s) => s.viewMode);
  const setViewMode = useDashboardStore((s) => s.setViewMode);
  const seedColumn = useDashboardStore((s) => s.seedColumn);
  const clearSeedColumn = useDashboardStore((s) => s.clearSeedColumn);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  useEffect(() => {
    if (seedColumn) setIsBuilderOpen(true);
  }, [seedColumn]);

  const closeBuilder = () => {
    setIsBuilderOpen(false);
    clearSeedColumn();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!dataset ? (
          <NoDatasetState />
        ) : (
          <div className="space-y-6">
            <KpiRow dataset={dataset} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5">
                <button
                  onClick={() => setViewMode("charts")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    viewMode === "charts"
                      ? "bg-card text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Graphiques
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Données brutes
                </button>
              </div>

              {viewMode === "charts" && !isBuilderOpen && (
                <Button size="sm" onClick={() => setIsBuilderOpen(true)}>
                  <Plus />
                  Nouveau graphique
                </Button>
              )}
            </div>

            {viewMode === "table" ? (
              <DataTable dataset={dataset} />
            ) : (
              <div className="space-y-4">
                {isBuilderOpen && (
                  <ChartBuilderPanel dataset={dataset} onClose={closeBuilder} initialField={seedColumn} />
                )}

                {charts.length === 0 && !isBuilderOpen ? (
                  <EmptyDashboard onCreateChart={() => setIsBuilderOpen(true)} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {charts.map((chart) => (
                      <ChartCard key={chart.id} chart={chart} dataset={dataset} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
