import { useMemo } from "react";
import { Copy, Eraser, Undo2, WandSparkles } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { ALL_COLUMNS_VALUE } from "@/cleaning/operations";
import { computeDatasetStats } from "@/lib/dataStats";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MissingValuesDialog } from "@/components/cleaning/MissingValuesDialog";
import { ColumnTypeDialog } from "@/components/cleaning/ColumnTypeDialog";
import { RenameColumnDialog } from "@/components/cleaning/RenameColumnDialog";
import { OperationFeedback } from "@/components/cleaning/OperationFeedback";

export function CleaningToolbar() {
  const dataset = useDatasetStore((s) => s.dataset);
  const history = useDatasetStore((s) => s.history);
  const removeDuplicates = useDatasetStore((s) => s.removeDuplicates);
  const trimWhitespace = useDatasetStore((s) => s.trimWhitespace);
  const undo = useDatasetStore((s) => s.undo);

  const stats = useMemo(() => (dataset ? computeDatasetStats(dataset) : null), [dataset]);
  const canUndo = history.length > 0;
  const lastEntry = history[history.length - 1];

  if (!dataset || !stats) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-soft">
        <span className="flex items-center gap-1.5 pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <WandSparkles className="h-3.5 w-3.5 text-accent" />
          Nettoyage
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={removeDuplicates}
          disabled={stats.duplicateRowCount === 0}
        >
          <Copy />
          Supprimer les doublons
          {stats.duplicateRowCount > 0 && (
            <span className="ml-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {stats.duplicateRowCount}
            </span>
          )}
        </Button>

        <Button variant="outline" size="sm" onClick={() => trimWhitespace(ALL_COLUMNS_VALUE)}>
          <Eraser />
          Nettoyer les espaces
        </Button>

        <MissingValuesDialog />
        <ColumnTypeDialog />
        <RenameColumnDialog />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
                <Undo2 />
                Annuler la dernière action
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {canUndo ? `Annuler : ${lastEntry.label}` : "Aucune action à annuler"}
          </TooltipContent>
        </Tooltip>
      </div>

      <OperationFeedback />
    </div>
  );
}
