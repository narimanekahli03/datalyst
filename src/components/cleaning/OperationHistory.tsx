import { History } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function OperationHistory() {
  const history = useDatasetStore((s) => s.history);
  const entries = [...history].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historique des opérations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune opération de nettoyage appliquée pour l'instant.
          </p>
        ) : (
          <ol className="scrollbar-thin max-h-72 overflow-y-auto pr-1">
            {entries.map((entry, index) => (
              <li key={entry.id} className="relative flex gap-3 pb-4 pl-1 last:pb-0">
                {index < entries.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px bg-border"
                  />
                )}
                <span
                  className={cn(
                    "relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2",
                    index === 0
                      ? "border-accent bg-accent/20"
                      : "border-border bg-secondary"
                  )}
                >
                  {index === 0 && (
                    <span className="absolute inset-0.5 rounded-full bg-accent" />
                  )}
                </span>

                <div className="min-w-0 flex-1 pt-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{entry.label}</p>
                    {index === 0 && (
                      <Badge variant="accent" className="shrink-0 px-1.5 py-0 text-[10px]">
                        Dernière
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{entry.detail}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-subtle">
                    {formatTime(entry.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
