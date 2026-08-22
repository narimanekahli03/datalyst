import { useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Link2,
  Loader2,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { Dataset } from "@/types/dataset";
import type { InsightCategory } from "@/types/insights";
import { useInsightsStore } from "@/store/insightsStore";
import { Button } from "@/components/ui/button";
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

interface InsightsPanelProps {
  dataset: Dataset;
}

export function InsightsPanel({ dataset }: InsightsPanelProps) {
  const status = useInsightsStore((s) => s.status);
  const insights = useInsightsStore((s) => s.insights);
  const errorMessage = useInsightsStore((s) => s.errorMessage);
  const generateInsights = useInsightsStore((s) => s.generateInsights);

  useEffect(() => {
    // Auto-triggers once per dataset "session" (i.e. once per file load):
    // the guard on `status === "idle"` means a later re-render caused by a
    // cleaning operation (dataset changes, status stays "ready") is a no-op.
    // Re-analysis after cleaning is opt-in via the "Régénérer" button —
    // auto-firing on every operation would burn the Mistral free-tier quota.
    if (status === "idle") generateInsights(dataset);
  }, [status, dataset, generateInsights]);

  const isLoading = status === "loading";

  return (
    <div className="overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-br from-accent/[0.05] to-transparent shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-accent/10 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Insights IA</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => generateInsights(dataset)}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
          Régénérer
        </Button>
      </div>

      <div className="px-5 py-4">
        {status === "idle" || isLoading ? (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Analyse de vos données par l'IA…
          </div>
        ) : status === "error" ? (
          <div className="flex items-start gap-2.5 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune observation notable.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {insights.map((insight, i) => {
              const Icon = CATEGORY_ICON[insight.category] ?? Sparkles;
              return (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-card/70 px-3 py-2.5 text-sm shadow-soft"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      CATEGORY_COLOR[insight.category] ?? "text-accent"
                    )}
                  />
                  <span className="text-foreground">{insight.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}