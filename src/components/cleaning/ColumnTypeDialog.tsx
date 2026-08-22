import { useMemo, useState } from "react";
import type { ColumnType } from "@/types/dataset";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight } from "lucide-react";

const TYPE_OPTIONS: { value: ColumnType; label: string }[] = [
  { value: "string", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Booléen" },
];

export function ColumnTypeDialog() {
  const dataset = useDatasetStore((s) => s.dataset);
  const convertColumnType = useDatasetStore((s) => s.convertColumnType);
  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState<string | undefined>(undefined);
  const [type, setType] = useState<ColumnType>("string");

  const columns = useMemo(() => dataset?.columns ?? [], [dataset]);
  const selectedColumn = column ?? columns[0]?.name;

  if (!dataset) return null;

  const handleApply = () => {
    if (!selectedColumn) return;
    convertColumnType(selectedColumn, type);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setColumn(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowLeftRight />
          Convertir un type
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convertir le type d'une colonne</DialogTitle>
          <DialogDescription>
            Les valeurs qui ne peuvent pas être converties deviendront vides.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="type-column">Colonne</Label>
            <Select value={selectedColumn} onValueChange={setColumn}>
              <SelectTrigger id="type-column">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type-new-type">Nouveau type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ColumnType)}>
              <SelectTrigger id="type-new-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleApply} disabled={!selectedColumn}>
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
