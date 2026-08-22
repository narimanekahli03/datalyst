import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyDashboardProps {
  onCreateChart: () => void;
}

export function EmptyDashboard({ onCreateChart }: EmptyDashboardProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <BarChart3 className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-display text-xl text-foreground">Construisez votre premier graphique</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Choisissez un type de graphique, une dimension et une mesure : l'aperçu se met à jour en
          temps réel pendant que vous configurez.
        </p>
      </div>
      <Button onClick={onCreateChart}>Créer un graphique</Button>
    </div>
  );
}
