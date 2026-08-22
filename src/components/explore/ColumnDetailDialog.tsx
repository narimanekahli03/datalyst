import { BarChart2 } from "lucide-react";
import type { ColumnExploration } from "@/types/explore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useNavigationStore } from "@/store/navigationStore";
import { useTheme } from "@/hooks/useTheme";
import { TYPE_DOT, TYPE_LABELS } from "@/lib/columnTypeMeta";
import { cn, formatDecimal, formatNumber, formatPercent } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MiniColumnChart } from "@/components/explore/MiniColumnChart";

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

interface ColumnDetailDialogProps {
  column: ColumnExploration | null;
  onClose: () => void;
}

export function ColumnDetailDialog({ column, onClose }: ColumnDetailDialogProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const requestChartForColumn = useDashboardStore((s) => s.requestChartForColumn);
  const setPage = useNavigationStore((s) => s.setPage);

  if (!column) return null;

  const handleVisualize = () => {
    requestChartForColumn(column.name);
    setPage("dashboard");
    onClose();
  };

  return (
    <Dialog open={Boolean(column)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", TYPE_DOT[column.columnType])} />
            <DialogTitle className="truncate">{column.name}</DialogTitle>
            <Badge variant="outline" className="shrink-0 font-normal">
              {TYPE_LABELS[column.columnType]}
            </Badge>
          </div>
          <DialogDescription>
            {column.missingCount === 0
              ? "Aucune valeur manquante."
              : `${formatNumber(column.missingCount)} valeur(s) manquante(s) (${formatPercent(column.missingPercent)}).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {column.stats.kind === "number" && (
            <>
              <MiniColumnChart data={column.stats.histogram} isDark={isDark} height={90} />
              <div>
                <DetailRow label="Nombre de valeurs" value={formatNumber(column.stats.count)} />
                <DetailRow label="Moyenne" value={formatDecimal(column.stats.mean)} />
                <DetailRow label="Médiane" value={formatDecimal(column.stats.median)} />
                <DetailRow label="Écart-type" value={formatDecimal(column.stats.stdDev)} />
                <DetailRow label="Minimum" value={formatDecimal(column.stats.min)} />
                <DetailRow label="1er quartile (Q1)" value={formatDecimal(column.stats.q1)} />
                <DetailRow label="3e quartile (Q3)" value={formatDecimal(column.stats.q3)} />
                <DetailRow label="Maximum" value={formatDecimal(column.stats.max)} />
                <DetailRow label="Écart interquartile" value={formatDecimal(column.stats.iqr)} />
              </div>
              {column.stats.outlierCount > 0 && (
                <>
                  <Separator />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-warning">
                      {formatNumber(column.stats.outlierCount)} valeur(s) aberrante(s)
                    </span>{" "}
                    ({formatPercent(column.stats.outlierPercent)}), en dehors de [
                    {formatDecimal(column.stats.lowerFence)} ; {formatDecimal(column.stats.upperFence)}
                    ], selon la méthode de Tukey (Q1/Q3 ± 1,5×écart interquartile).
                  </p>
                </>
              )}
            </>
          )}

          {column.stats.kind === "categorical" && (
            <>
              <DetailRow label="Valeurs uniques" value={formatNumber(column.stats.uniqueCount)} />
              <div className="space-y-2 pt-1">
                {column.stats.topValues.map((entry) => (
                  <div key={entry.value} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-foreground" title={entry.value}>
                        {entry.value}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatNumber(entry.count)} ({formatPercent(entry.percent)})
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
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
              <MiniColumnChart data={column.stats.timeline} isDark={isDark} height={90} />
              <DetailRow label="Date la plus ancienne" value={column.stats.min || "-"} />
              <DetailRow label="Date la plus récente" value={column.stats.max || "-"} />
              <DetailRow label="Étendue" value={`${formatNumber(column.stats.rangeDays)} jour(s)`} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handleVisualize}>
            <BarChart2 />
            Visualiser cette colonne
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
