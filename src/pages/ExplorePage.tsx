import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import type { ColumnExploration, DatasetExploration } from "@/types/explore";
import { computeExploration } from "@/lib/exploreStats";
import { Header } from "@/components/layout/Header";
import { NoDatasetState } from "@/components/shared/NoDatasetState";
import { ExploreSummaryPanel } from "@/components/explore/ExploreSummaryPanel";
import { ColumnExplorationCard } from "@/components/explore/ColumnExplorationCard";
import { ColumnDetailDialog } from "@/components/explore/ColumnDetailDialog";
import { CorrelationMatrix } from "@/components/explore/CorrelationMatrix";
import { OutlierSummary } from "@/components/explore/OutlierSummary";

function ExploreLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card/60 px-8 py-24 text-center shadow-soft">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/15" />
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Analyse du jeu de données…</p>
        <p className="text-sm text-muted-foreground">
          Calcul des statistiques, des corrélations et des valeurs aberrantes.
        </p>
      </div>
    </div>
  );
}

export function ExplorePage() {
  const dataset = useDatasetStore((s) => s.dataset);
  const [exploration, setExploration] = useState<DatasetExploration | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [detailColumn, setDetailColumn] = useState<ColumnExploration | null>(null);

  useEffect(() => {
    if (!dataset) {
      setExploration(null);
      setIsComputing(false);
      return;
    }
    setIsComputing(true);
    // Deferred to the next tick so the loading state actually paints before
    // the (synchronous) stats computation blocks the main thread — matters
    // once the dataset gets into the tens of thousands of rows.
    const timer = setTimeout(() => {
      setExploration(computeExploration(dataset));
      setIsComputing(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [dataset]);

  const numericColumnNames =
    exploration?.columns.filter((c) => c.stats.kind === "number").map((c) => c.name) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!dataset ? (
          <NoDatasetState
            icon={Compass}
            title="Aucune donnée à explorer"
            description="L'exploration automatique analyse vos données une fois qu'elles ont été chargées et nettoyées. Retournez à la page de nettoyage pour importer un fichier."
          />
        ) : isComputing || !exploration ? (
          <ExploreLoadingState />
        ) : (
          <div className="space-y-6">
            <ExploreSummaryPanel exploration={exploration} />

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Analyse par colonne</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {exploration.columns.map((column) => (
                  <ColumnExplorationCard
                    key={column.name}
                    column={column}
                    onOpenDetail={setDetailColumn}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CorrelationMatrix columns={numericColumnNames} correlations={exploration.correlations} />
              <OutlierSummary columns={exploration.columns} />
            </div>
          </div>
        )}
      </main>

      <ColumnDetailDialog column={detailColumn} onClose={() => setDetailColumn(null)} />
    </div>
  );
}
