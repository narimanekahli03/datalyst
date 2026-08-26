import { useRef } from "react";
import { AlertCircle, Loader2, Table2, X } from "lucide-react";
import { useSecondaryTableStore } from "@/store/secondaryTableStore";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls";

/**
 * Compact "join a second table" affordance, scoped to the query page only —
 * loading/cleaning/dashboard stay on the single primary dataset.
 */
export function SecondaryTableWidget() {
  const status = useSecondaryTableStore((s) => s.status);
  const dataset = useSecondaryTableStore((s) => s.dataset);
  const tableName = useSecondaryTableStore((s) => s.tableName);
  const errorMessage = useSecondaryTableStore((s) => s.errorMessage);
  const load = useSecondaryTableStore((s) => s.load);
  const clear = useSecondaryTableStore((s) => s.clear);
  const inputRef = useRef<HTMLInputElement>(null);

  if (status === "ready" && dataset && tableName) {
    return (
      <div className="flex w-fit items-center gap-2 rounded-lg border border-accent/25 bg-accent/[0.04] px-3 py-1.5 text-xs">
        <Table2 className="h-3.5 w-3.5 text-accent" />
        <span className="text-foreground">
          Table jointe : <code className="font-mono font-medium">{tableName}</code>
          <span className="text-muted-foreground">
            {" "}
            ({dataset.fileName} · {formatNumber(dataset.rows.length)} lignes ·{" "}
            {formatNumber(dataset.columns.length)} colonnes)
          </span>
        </span>
        <button
          onClick={clear}
          aria-label="Retirer la table jointe"
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-fit items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2.5 text-xs font-normal"
        disabled={status === "loading"}
        onClick={() => inputRef.current?.click()}
      >
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Table2 className="h-3.5 w-3.5" />
        )}
        {status === "loading" ? "Chargement…" : "Ajouter une deuxième table pour les jointures"}
      </Button>
      {status === "error" && errorMessage && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMessage}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) load(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
