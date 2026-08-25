import {
  Activity,
  AlertCircle,
  BarChart3,
  Link2,
  Loader2,
  PieChart,
  ShieldAlert,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Dataset } from "@/types/dataset";
import type { InsightCategory } from "@/types/insights";
import { useAgentExplorationStore } from "@/store/agentExplorationStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SqlCodeBlock } from "@/components/query/SqlCodeBlock";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<InsightCategory, typeof Sparkles> = {
  qualite: ShieldAlert,
  distribution: Activity,
  correlation: Link2,
  categorie: PieChart,
  general: Sparkles,
};

const CATEGORY_COLOR: Record<InsightCategory, string> = {
  qualite: "text-warning",
  distribution: "text-accent",
  correlation: "text-[hsl(280_60%_58%)]",
  categorie: "text-accent",
  general: "text-accent",
};

const MAX_STEPS_LABEL = 3;

interface AgentExplorationPanelProps {
  dataset: Dataset;
}

export function AgentExplorationPanel({ dataset }: AgentExplorationPanelProps) {
  const phase = useAgentExplorationStore((s) => s.phase);
  const trail = useAgentExplorationStore((s) => s.trail);
  const summary = useAgentExplorationStore((s) => s.summary);
  const findings = useAgentExplorationStore((s) => s.findings);
  const errorMessage = useAgentExplorationStore((s) => s.errorMessage);
  const run = useAgentExplorationStore((s) => s.run);

  const isBusy = phase === "thinking" || phase === "executing";
  const hasRun = phase !== "idle";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          Agent d'exploration IA
        </CardTitle>
        <CardDescription>
          L'IA décide elle-même des requêtes à exécuter pour comprendre vos données, étape par
          étape, puis résume ce qu'elle a découvert. Jusqu'à {MAX_STEPS_LABEL} étapes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => run(dataset)} disabled={isBusy}>
          {isBusy ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {hasRun ? "Relancer l'agent" : "Lancer l'agent"}
        </Button>

        {trail.length > 0 && (
          <ol className="space-y-3">
            {trail.map((entry) => (
              <li
                key={entry.stepNumber}
                className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="accent" className="gap-1">
                    {entry.action === "chart" && <BarChart3 className="h-3 w-3" />}
                    Étape {entry.stepNumber}/{MAX_STEPS_LABEL}
                  </Badge>
                  {entry.action === "query" && !entry.result && !entry.errorMessage && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Exécution…
                    </span>
                  )}
                </div>
                {entry.reasoning && (
                  <p className="text-sm italic text-muted-foreground">{entry.reasoning}</p>
                )}
                {entry.action === "chart" ? (
                  entry.chart ? (
                    <div className="space-y-1.5">
                      <div className="h-[236px] overflow-hidden rounded-lg border border-border bg-background/50 p-2">
                        <ChartRenderer
                          config={{
                            id: `agent-preview-${entry.stepNumber}`,
                            title: entry.chart.title,
                            type: entry.chart.type,
                            xField: entry.chart.xField,
                            yFields: entry.chart.yFields,
                            aggregation: entry.chart.aggregation,
                            groupByField: null,
                            createdAt: 0,
                          }}
                          dataset={dataset}
                          compact
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        → Graphique « {entry.chart.title} » ajouté au tableau de bord
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-destructive">
                      → Échec de l'ajout du graphique : {entry.errorMessage}
                    </p>
                  )
                ) : (
                  <>
                    {entry.sql && <SqlCodeBlock sql={entry.sql} />}
                    {entry.errorMessage ? (
                      <p className="text-xs text-destructive">
                        → Échec de la requête : {entry.errorMessage}
                      </p>
                    ) : (
                      entry.result && (
                        <p className="text-xs text-muted-foreground">
                          → {entry.result.rowCount} ligne(s), {entry.result.columns.length} colonne(s)
                        </p>
                      )
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}

        {phase === "thinking" && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Réflexion de l'agent…
          </div>
        )}

        {phase === "error" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.04] px-4 py-3.5">
              <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Ce que l'agent a découvert</p>
                <p className="text-sm leading-relaxed text-foreground">{summary}</p>
              </div>
            </div>
            {findings.length > 0 && (
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {findings.map((finding, i) => {
                  const Icon = CATEGORY_ICON[finding.category] ?? Sparkles;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-card/70 px-3 py-2.5 text-sm shadow-soft"
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          CATEGORY_COLOR[finding.category] ?? "text-accent"
                        )}
                      />
                      <span className="text-foreground">{finding.text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
