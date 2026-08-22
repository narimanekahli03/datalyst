import { History, RotateCcw } from "lucide-react";
import type { TextToSqlHistoryEntry } from "@/types/textToSql";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QueryHistoryPanelProps {
  entries: TextToSqlHistoryEntry[];
  onReplay: (id: string) => void;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function QueryHistoryPanel({ entries, onReplay }: QueryHistoryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historique des questions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune question posée pour l'instant.</p>
        ) : (
          <ol className="scrollbar-thin max-h-96 space-y-2.5 overflow-y-auto pr-1">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{entry.question}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => onReplay(entry.id)}
                    title="Revoir cette question"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={entry.sql}>
                  {entry.sql}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-subtle">{formatTime(entry.timestamp)}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
