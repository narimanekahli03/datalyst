import { BarChart2, TriangleAlert } from "lucide-react";
import type { ColumnExploration } from "@/types/explore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useTheme } from "@/hooks/useTheme";
import { TYPE_DOT, TYPE_LABELS } from "@/lib/columnTypeMeta";
import { formatDecimal, formatNumber, formatPercent, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniColumnChart } from "@/components/explore/MiniColumnChart";

interface StatCellProps {
  label: string;
  value: string;
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1.5 text-center">
      <p className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

interface ColumnExplorationCardProps {
  column: ColumnExploration;
  onOpenDetail: (column: ColumnExploration) => void;
}

export function ColumnExplorationCard({ column, onOpenDetail }: ColumnExplorationCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const requestChartForColumn = useDashboardStore((s) => s.requestChartForColumn);
  const setPage = useNavigationStore((s) => s.setPage);

  const handleVisualize = () => {
    requestChartForColumn(column.name);
    setPage("dashboard");
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(column)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenDetail(column);
      }}
      className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-elevated"
    >
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TYPE_DOT[column.columnType])} />
            <span className="truncate text-sm font-semibold text-foreground" title={column.name}>
              {column.name}
            </span>
          </div>
          <Badge variant="outline" className="shrink-0 font-normal">
            {TYPE_LABELS[column.columnType]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {column.missingCount === 0
            ? "Complet"
            : `${formatPercent(column.missingPercent)} manquant (${formatNumber(column.missingCount)})`}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {column.stats.kind === "number" && (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <StatCell label="Moyenne" value={formatDecimal(column.stats.mean)} />
              <StatCell label="Médiane" value={formatDecimal(column.stats.median)} />
              <StatCell label="Écart-type" value={formatDecimal(column.stats.stdDev)} />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Min {formatDecimal(column.stats.min)} · Max {formatDecimal(column.stats.max)}
            </p>
            <MiniColumnChart data={column.stats.histogram} isDark={isDark} />
            {column.stats.outlierCount > 0 && (
              <p className="flex items-center justify-center gap-1 text-xs text-warning">
                <TriangleAlert className="h-3 w-3" />
                {formatNumber(column.stats.outlierCount)} valeur(s) aberrante(s)
              </p>
            )}
          </>
        )}

        {column.stats.kind === "categorical" && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <StatCell label="Valeurs uniques" value={formatNumber(column.stats.uniqueCount)} />
              <StatCell
                label="Plus fréquente"
                value={column.stats.topValues[0]?.value ?? "-"}
              />
            </div>
            <div className="space-y-1.5">
              {column.stats.topValues.map((entry) => (
                <div key={entry.value} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground" title={entry.value}>
                      {entry.value}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatNumber(entry.count)} ({formatPercent(entry.percent)})
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(entry.percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {column.stats.kind === "date" && (
          <>
            <p className="text-center text-xs text-muted-foreground">
              {column.stats.min || "-"} → {column.stats.max || "-"}
              {column.stats.rangeDays > 0 && ` (${formatNumber(column.stats.rangeDays)} j)`}
            </p>
            <MiniColumnChart data={column.stats.timeline} isDark={isDark} />
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            handleVisualize();
          }}
        >
          <BarChart2 />
          Visualiser cette colonne
        </Button>
      </CardContent>
    </Card>
  );
}
