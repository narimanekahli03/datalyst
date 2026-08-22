import { useEffect, useMemo, useState } from "react";
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
import { PenLine, Trash2 } from "lucide-react";

export function RenameColumnDialog() {
  const dataset = useDatasetStore((s) => s.dataset);
  const renameColumn = useDatasetStore((s) => s.renameColumn);
  const deleteColumn = useDatasetStore((s) => s.deleteColumn);

  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState<string | undefined>(undefined);
  const [newName, setNewName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const columns = useMemo(() => dataset?.columns ?? [], [dataset]);
  const selectedColumn = column ?? columns[0]?.name;

  useEffect(() => {
    if (selectedColumn) setNewName(selectedColumn);
    setConfirmingDelete(false);
  }, [selectedColumn]);

  if (!dataset) return null;

  const handleRename = () => {
    if (!selectedColumn) return;
    renameColumn(selectedColumn, newName);
    setOpen(false);
  };

  const handleDelete = () => {
    if (!selectedColumn) return;
    deleteColumn(selectedColumn);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setConfirmingDelete(false);
          setColumn(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PenLine />
          Renommer / supprimer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer ou supprimer une colonne</DialogTitle>
          <DialogDescription>
            Sélectionnez une colonne, puis renommez-la ou supprimez-la définitivement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-column">Colonne</Label>
            <Select value={selectedColumn} onValueChange={setColumn}>
              <SelectTrigger id="rename-column">
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
            <Label htmlFor="rename-new-name">Nouveau nom</Label>
            <Input
              id="rename-new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          {confirmingDelete && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Supprimer définitivement la colonne "{selectedColumn}" ? Cette action peut être
              annulée avec le bouton Annuler la dernière action.
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {confirmingDelete ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Confirmer la suppression
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              disabled={!selectedColumn}
            >
              <Trash2 />
              Supprimer la colonne
            </Button>
          )}
          {!confirmingDelete && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fermer
              </Button>
              <Button
                onClick={handleRename}
                disabled={!selectedColumn || newName.trim() === ""}
              >
                Renommer
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
