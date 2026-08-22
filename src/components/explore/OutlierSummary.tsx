import { CircleCheck, TriangleAlert } from "lucide-react";
import type { ColumnExploration, NumericColumnStats } from "@/types/explore";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface OutlierSummaryProps {
  columns: ColumnExploration[];
}

export function OutlierSummary({ columns }: OutlierSummaryProps) {
  const numericColumns = columns.filter(
    (c): c is ColumnExploration & { stats: NumericColumnStats } => c.stats.kind === "number"
  );
  const withOutliers = numericColumns.filter((c) => c.stats.outlierCount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Valeurs aberrantes</CardTitle>
        <CardDescription>
          Détection automatique par la méthode de Tukey (au-delà de 1,5× l'écart interquartile).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {numericColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune colonne numérique à analyser.</p>
        ) : withOutliers.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CircleCheck className="h-4 w-4 shrink-0" />
            Aucune valeur aberrante détectée sur les {formatNumber(numericColumns.length)} colonne(s)
            numérique(s).
          </p>
        ) : (
          <ul className="space-y-2">
            {withOutliers
              .sort((a, b) => b.stats.outlierCount - a.stats.outlierCount)
              .map((column) => (
                <li
                  key={column.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
                    <span className="truncate text-sm font-medium text-foreground">{column.name}</span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatNumber(column.stats.outlierCount)} valeur(s) ({formatPercent(column.stats.outlierPercent)})
                    · hors [{formatDecimal(column.stats.lowerFence)} ; {formatDecimal(column.stats.upperFence)}]
                  </span>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
