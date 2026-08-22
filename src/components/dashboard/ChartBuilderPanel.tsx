import { useState } from "react";
import {
  AreaChart,
  BarChart3,
  Check,
  LineChart,
  PieChart,
  Plus,
  ScatterChart,
  X,
} from "lucide-react";
import type { AggregationType, ChartConfig, ChartType } from "@/types/dashboard";
import type { Dataset } from "@/types/dataset";
import { useDashboardStore } from "@/store/dashboardStore";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CHART_TYPES: { type: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { type: "bar", label: "Barres", icon: BarChart3 },
  { type: "line", label: "Courbe", icon: LineChart },
  { type: "area", label: "Aires", icon: AreaChart },
  { type: "pie", label: "Camembert", icon: PieChart },
  { type: "scatter", label: "Nuage de points", icon: ScatterChart },
];

const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: "sum", label: "Somme" },
  { value: "avg", label: "Moyenne" },
  { value: "count", label: "Comptage" },
  { value: "min", label: "Minimum" },
  { value: "max", label: "Maximum" },
];

interface ChartBuilderPanelProps {
  dataset: Dataset;
  onClose: () => void;
  /** Pre-fills X (dimension) or Y (measure) depending on the column's type — set when
   *  arriving from the "Visualiser" action on the Explore page. */
  initialField?: string | null;
}

export function ChartBuilderPanel({ dataset, onClose, initialField = null }: ChartBuilderPanelProps) {
  const addChart = useDashboardStore((s) => s.addChart);

  const initialColumn = initialField ? dataset.columns.find((c) => c.name === initialField) : undefined;
  const seedsAsMeasure = initialColumn?.type === "number";

  const [type, setType] = useState<ChartType>("bar");
  const [title, setTitle] = useState("");
  const [xField, setXField] = useState<string | null>(
    initialColumn && !seedsAsMeasure ? initialColumn.name : null
  );
  const [yFields, setYFields] = useState<string[]>(
    initialColumn && seedsAsMeasure ? [initialColumn.name] : []
  );
  const [aggregation, setAggregation] = useState<AggregationType>("sum");
  const [groupByField, setGroupByField] = useState<string | null>(null);

  const isSingleY = type === "pie" || type === "scatter";
  const numericColumns = dataset.columns.filter((c) => c.type === "number");
  const xOptions = type === "scatter" ? numericColumns : dataset.columns;
  const groupByOptions = dataset.columns.filter((c) => c.name !== xField);
  const canGroupBy = type !== "pie" && (isSingleY || yFields.length === 1);

  const handleTypeChange = (nextType: ChartType) => {
    setType(nextType);
    const nextIsSingleY = nextType === "pie" || nextType === "scatter";
    if (nextIsSingleY && yFields.length > 1) setYFields(yFields.slice(0, 1));
    if (nextType === "pie") setGroupByField(null);
    if (nextType === "scatter" && xField && !numericColumns.some((c) => c.name === xField)) {
      setXField(null);
    }
  };

  const toggleYField = (name: string) => {
    const next = isSingleY
      ? yFields.includes(name)
        ? []
        : [name]
      : yFields.includes(name)
        ? yFields.filter((f) => f !== name)
        : [...yFields, name];
    setYFields(next);
    if (next.length > 1 && groupByField) setGroupByField(null);
  };

  const defaultTitle =
    xField && yFields.length > 0 ? `${yFields.join(", ")} par ${xField}` : "Nouveau graphique";
  const isValid = xField !== null && yFields.length > 0;

  const previewConfig: ChartConfig = {
    id: "preview",
    title: title.trim() || defaultTitle,
    type,
    xField,
    yFields,
    aggregation,
    groupByField: canGroupBy ? groupByField : null,
    createdAt: 0,
  };

  const handleAdd = () => {
    if (!isValid) return;
    addChart({
      title: title.trim() || defaultTitle,
      type,
      xField,
      yFields,
      aggregation,
      groupByField: canGroupBy ? groupByField : null,
    });
    onClose();
  };

  return (
    <Card className="animate-in fade-in-0 slide-in-from-top-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Nouveau graphique</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type de graphique</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {CHART_TYPES.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    title={option.label}
                    onClick={() => handleTypeChange(option.type)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[10px] transition-colors",
                      type === option.type
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:border-accent/30 hover:text-foreground"
                    )}
                  >
                    <option.icon className="h-4 w-4" strokeWidth={1.75} />
                    <span className="leading-none">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chart-title">Titre</Label>
              <Input
                id="chart-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={defaultTitle}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chart-x">
                {type === "scatter" ? "Axe X (numérique)" : "Colonne X (dimension)"}
              </Label>
              <Select value={xField ?? undefined} onValueChange={setXField}>
                <SelectTrigger id="chart-x">
                  <SelectValue placeholder="Choisir une colonne" />
                </SelectTrigger>
                <SelectContent>
                  {xOptions.map((col) => (
                    <SelectItem key={col.name} value={col.name}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{type === "scatter" ? "Axe Y (numérique)" : "Colonne(s) Y (mesure)"}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {yFields.length === 0 ? "Choisir une ou plusieurs colonnes" : yFields.join(", ")}
                    </span>
                    <Plus className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                  {numericColumns.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Aucune colonne numérique dans ce jeu de données.
                    </p>
                  )}
                  {numericColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.name}
                      checked={yFields.includes(col.name)}
                      onCheckedChange={() => toggleYField(col.name)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {col.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {type !== "scatter" && (
              <div className="space-y-1.5">
                <Label htmlFor="chart-agg">Agrégation</Label>
                <Select value={aggregation} onValueChange={(v) => setAggregation(v as AggregationType)}>
                  <SelectTrigger id="chart-agg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATIONS.map((agg) => (
                      <SelectItem key={agg.value} value={agg.value}>
                        {agg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type !== "pie" && (
              <div className="space-y-1.5">
                <Label htmlFor="chart-groupby">Regroupement par catégorie (optionnel)</Label>
                <Select
                  value={groupByField ?? "__none__"}
                  onValueChange={(v) => setGroupByField(v === "__none__" ? null : v)}
                  disabled={!canGroupBy}
                >
                  <SelectTrigger id="chart-groupby">
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {groupByOptions.map((col) => (
                      <SelectItem key={col.name} value={col.name}>
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canGroupBy && (
                  <p className="text-xs text-muted-foreground">
                    Disponible avec une seule colonne Y sélectionnée.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aperçu
            </p>
            <div className="flex-1 rounded-lg border border-border bg-background/50 p-2">
              <ChartRenderer config={previewConfig} dataset={dataset} compact />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleAdd} disabled={!isValid}>
            <Check />
            Ajouter au tableau de bord
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
