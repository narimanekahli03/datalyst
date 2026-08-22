import type { ElementType } from "react";
import { LayoutDashboard, Upload } from "lucide-react";
import { useNavigationStore } from "@/store/navigationStore";
import { Button } from "@/components/ui/button";

interface NoDatasetStateProps {
  icon?: ElementType;
  title?: string;
  description?: string;
}

export function NoDatasetState({
  icon: Icon = LayoutDashboard,
  title = "Aucune donnée à visualiser",
  description = "Cette page affiche vos données une fois qu'elles ont été chargées et nettoyées. Retournez à la page de nettoyage pour importer un fichier.",
}: NoDatasetStateProps) {
  const setPage = useNavigationStore((s) => s.setPage);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 px-8 py-16 text-center shadow-soft">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-display text-xl text-foreground">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Button onClick={() => setPage("cleaning")}>
        <Upload />
        Aller à la page de nettoyage
      </Button>
    </div>
  );
}
