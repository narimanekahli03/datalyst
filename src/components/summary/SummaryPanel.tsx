import { useMemo, type ElementType } from "react";
import { Copy, Hash, Rows3 } from "lucide-react";
import type { Dataset } from "@/types/dataset";
import { computeDatasetStats } from "@/lib/dataStats";
import { formatNumber, formatPercent, cn } from "@/lib/utils";
import { TYPE_LABELS, TYPE_DOT } from "@/lib/columnTypeMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Severity = "none" | "low" | "medium" | "high";

function severityForMissingPercent(percent: number): Severity {
  if (percent <= 0) return "none";
  if (percent < 15) return "low";
  if (percent < 40) return "medium";
  return "high";
}

const SEVERITY_BAR: Record<Severity, { track: string; fill: string }> = {
  none: { track: "bg-secondary", fill: "bg-transparent" },
  low: { track: "bg-accent/15", fill: "bg-accent" },
  medium: { track: "bg-warning/15", fill: "bg-warning" },
  high: { track: "bg-destructive/15", fill: "bg-destructive" },
};

function completenessTone(percent: number): {
  text: string;
  track: string;
  fill: string;
  label: string;
} {
  if (percent >= 90)
    return { text: "text-success", track: "bg-success/15", fill: "bg-success", label: "Bonne qualité" };
  if (percent >= 70)
    return {
      text: "text-amber-700 dark:text-amber-400",
      track: "bg-warning/15",
      fill: "bg-warning",
      label: "Qualité moyenne",
    };
  return {
    text: "text-destructive",
    track: "bg-destructive/15",
    fill: "bg-destructive",
    label: "Qualité faible",
  };
}

interface SummaryPanelProps {
  dataset: Dataset;
}

interface StatTileProps {
  icon: ElementType;
  label: string;
  value: string;
  tone?: "default" | "warning";
}

function StatTile({ icon: Icon, label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/50 px-2 py-3 text-center">
      <Icon
        className={cn("h-4 w-4", tone === "warning" ? "text-warning" : "text-accent")}
        strokeWidth={1.75}
      />
      <p className="font-display text-lg leading-tight text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

export function SummaryPanel({ dataset }: SummaryPanelProps) {
  const stats = useMemo(() => computeDatasetStats(dataset), [dataset]);

  const totalCells = stats.rowCount * stats.columnCount;
  const completeness = totalCells === 0 ? 100 : 100 - (stats.totalMissingCount / totalCells) * 100;
  const tone = completenessTone(completeness);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aperçu du jeu de données</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2.5 rounded-xl border border-border bg-gradient-to-br from-background/80 to-secondary/40 px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl leading-none text-foreground">
                {Math.round(completeness)}%
              </span>
              <span className={cn("text-sm font-medium", tone.text)}>{tone.label}</span>
            </div>
          </div>
          <div className={cn("h-2 w-full overflow-hidden rounded-full", tone.track)}>
            <div
              className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone.fill)}
              style={{ width: `${Math.min(completeness, 100)}%` }}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Complétude globale des cellules : {formatNumber(stats.totalMissingCount)} valeur(s)
            manquante(s) sur {formatNumber(totalCells)}.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile icon={Rows3} label="Lignes" value={formatNumber(stats.rowCount)} />
          <StatTile icon={Hash} label="Colonnes" value={formatNumber(stats.columnCount)} />
          <StatTile
            icon={Copy}
            label="Doublons"
            value={formatNumber(stats.duplicateRowCount)}
            tone={stats.duplicateRowCount > 0 ? "warning" : "default"}
          />
        </div>

        <Separator />

        <div className="space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Détail par colonne
          </p>
          <div className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto pr-1">
            {stats.columns.map((col) => {
              const severity = severityForMissingPercent(col.missingPercent);
              const bar = SEVERITY_BAR[severity];
              return (
                <div
                  key={col.name}
                  className="rounded-md px-2 py-2 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground" title={col.name}>
                      {col.name}
                    </span>
                    <Badge variant="outline" className="shrink-0 gap-1.5 font-normal">
                      <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[col.type])} />
                      {TYPE_LABELS[col.type]}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className={cn("h-1.5 flex-1 overflow-hidden rounded-full", bar.track)}>
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-500", bar.fill)}
                        style={{ width: `${Math.min(col.missingPercent, 100)}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {col.missingCount === 0
                        ? "Complet"
                        : `${formatNumber(col.missingCount)} (${formatPercent(col.missingPercent)})`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
