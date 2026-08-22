import { useState } from "react";
import { Gauge, Plus, X } from "lucide-react";
import type { AggregationType } from "@/types/dashboard";
import type { Dataset } from "@/types/dataset";
import { useDashboardStore } from "@/store/dashboardStore";
import { computeKpiValue, isKpiFieldMissing } from "@/lib/chartData";
import { cn, formatCompactNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AGGREGATION_LABELS: Record<AggregationType, string> = {
  sum: "Somme",
  avg: "Moyenne",
  count: "Comptage",
  min: "Minimum",
  max: "Maximum",
};

const ROW_COUNT_VALUE = "__rowcount__";

interface KpiRowProps {
  dataset: Dataset;
}

export function KpiRow({ dataset }: KpiRowProps) {
  const kpis = useDashboardStore((s) => s.kpis);
  const addKpi = useDashboardStore((s) => s.addKpi);
  const removeKpi = useDashboardStore((s) => s.removeKpi);

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [field, setField] = useState<string>(ROW_COUNT_VALUE);
  const [aggregation, setAggregation] = useState<AggregationType>("sum");

  const numericColumns = dataset.columns.filter((c) => c.type === "number");
  const isRowCount = field === ROW_COUNT_VALUE;
  const defaultLabel = isRowCount ? "Nombre de lignes" : `${AGGREGATION_LABELS[aggregation]} de ${field}`;

  const handleAdd = () => {
    addKpi({
      label: label.trim() || defaultLabel,
      field: isRowCount ? null : field,
      aggregation: isRowCount ? "count" : aggregation,
    });
    setOpen(false);
    setLabel("");
    setField(ROW_COUNT_VALUE);
    setAggregation("sum");
  };

  return (
    <div className="flex flex-wrap gap-3">
      {kpis.map((kpi) => {
        const missing = isKpiFieldMissing(dataset, kpi);
        const value = missing ? null : computeKpiValue(dataset, kpi);
        return (
          <div
            key={kpi.id}
            className="group relative flex min-w-[10rem] flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 shadow-soft"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Gauge className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl leading-tight text-foreground">
                {value === null ? "-" : formatCompactNumber(value)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <button
              onClick={() => removeKpi(kpi.id)}
              aria-label="Supprimer cet indicateur"
              className="absolute right-1.5 top-1.5 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            className={cn(
              "flex min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
            )}
          >
            <Plus className="h-4 w-4" />
            Ajouter un indicateur
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un indicateur clé</DialogTitle>
            <DialogDescription>
              Un chiffre calculé à partir de vos données, affiché en haut du tableau de bord.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="kpi-field">Donnée</Label>
              <Select value={field} onValueChange={setField}>
                <SelectTrigger id="kpi-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROW_COUNT_VALUE}>Nombre de lignes (total)</SelectItem>
                  {numericColumns.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isRowCount && (
              <div className="space-y-1.5">
                <Label htmlFor="kpi-agg">Agrégation</Label>
                <Select value={aggregation} onValueChange={(v) => setAggregation(v as AggregationType)}>
                  <SelectTrigger id="kpi-agg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGGREGATION_LABELS) as AggregationType[]).map((agg) => (
                      <SelectItem key={agg} value={agg}>
                        {AGGREGATION_LABELS[agg]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="kpi-label">Libellé</Label>
              <Input
                id="kpi-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={defaultLabel}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAdd}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
