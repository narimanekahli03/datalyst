import { useMemo, useState } from "react";
import type { MissingValueStrategy } from "@/types/dataset";
import { ALL_COLUMNS_VALUE } from "@/cleaning/operations";
import { useDatasetStore } from "@/store/datasetStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Droplets } from "lucide-react";

const STRATEGIES: { value: MissingValueStrategy; label: string }[] = [
  { value: "drop-row", label: "Supprimer la ligne" },
  { value: "fill-value", label: "Remplacer par une valeur" },
  { value: "fill-mean", label: "Remplacer par la moyenne (colonnes numériques)" },
  { value: "fill-median", label: "Remplacer par la médiane (colonnes numériques)" },
];

export function MissingValuesDialog() {
  const dataset = useDatasetStore((s) => s.dataset);
  const handleMissingValues = useDatasetStore((s) => s.handleMissingValues);
  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState<string>(ALL_COLUMNS_VALUE);
  const [strategy, setStrategy] = useState<MissingValueStrategy>("drop-row");
  const [fillValue, setFillValue] = useState("");

  const columns = useMemo(() => dataset?.columns ?? [], [dataset]);

  if (!dataset) return null;

  const isFillValueMissing = strategy === "fill-value" && fillValue.trim() === "";

  const handleApply = () => {
    if (isFillValueMissing) return;
    handleMissingValues(column, strategy, fillValue);
    setOpen(false);
    setFillValue("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Droplets />
          Valeurs manquantes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gérer les valeurs manquantes</DialogTitle>
          <DialogDescription>
            Choisissez la colonne concernée et la stratégie à appliquer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="missing-column">Colonne</Label>
            <Select value={column} onValueChange={setColumn}>
              <SelectTrigger id="missing-column">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COLUMNS_VALUE}>Toutes les colonnes</SelectItem>
                {columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="missing-strategy">Stratégie</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as MissingValueStrategy)}>
              <SelectTrigger id="missing-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {strategy === "fill-value" && (
            <div className="space-y-1.5">
              <Label htmlFor="missing-fill-value">Valeur de remplacement</Label>
              <Input
                id="missing-fill-value"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                placeholder="Ex : 0, N/A, inconnu…"
              />
              {isFillValueMissing && (
                <p className="text-xs text-muted-foreground">
                  Indiquez une valeur : une case vide resterait comptée comme manquante.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleApply} disabled={isFillValueMissing}>
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
