import type { ElementType } from "react";
import { Copy, Database, HardDrive, Rows3, TriangleAlert } from "lucide-react";
import type { DatasetExploration } from "@/types/explore";
import { formatBytes, formatNumber, formatPercent } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatTileProps {
  icon: ElementType;
  label: string;
  value: string;
  tone?: "default" | "warning";
}

function StatTile({ icon: Icon, label, value, tone = "default" }: StatTileProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 py-4 text-center">
      <Icon className={cn("h-4 w-4", tone === "warning" ? "text-warning" : "text-accent")} strokeWidth={1.75} />
      <p className="text-xl font-semibold leading-tight text-foreground">{value}</p>
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

interface ExploreSummaryPanelProps {
  exploration: DatasetExploration;
}

export function ExploreSummaryPanel({ exploration }: ExploreSummaryPanelProps) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
        <StatTile icon={Rows3} label="Lignes" value={formatNumber(exploration.rowCount)} />
        <StatTile icon={Database} label="Colonnes" value={formatNumber(exploration.columnCount)} />
        <StatTile
          icon={TriangleAlert}
          label={`Manquantes (${formatPercent(exploration.missingPercent)})`}
          value={formatNumber(exploration.totalMissing)}
          tone={exploration.totalMissing > 0 ? "warning" : "default"}
        />
        <StatTile
          icon={Copy}
          label="Doublons"
          value={formatNumber(exploration.duplicateRowCount)}
          tone={exploration.duplicateRowCount > 0 ? "warning" : "default"}
        />
        <StatTile icon={HardDrive} label="Poids estimé" value={formatBytes(exploration.estimatedBytes)} />
      </CardContent>
    </Card>
  );
}
