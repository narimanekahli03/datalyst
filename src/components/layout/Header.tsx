import { Sparkles, RotateCcw, PaintBucket, Compass, LayoutDashboard, Bot, FileText } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { useNavigationStore, type AppPage } from "@/store/navigationStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExportMenu } from "@/components/export/ExportMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn, formatNumber } from "@/lib/utils";

const NAV_ITEMS: { page: AppPage; label: string; icon: typeof PaintBucket }[] = [
  { page: "cleaning", label: "Nettoyage", icon: PaintBucket },
  { page: "explore", label: "Exploration", icon: Compass },
  { page: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { page: "query", label: "Interroger", icon: Bot },
  { page: "report", label: "Rapport", icon: FileText },
];

function NavTabs() {
  const page = useNavigationStore((s) => s.page);
  const setPage = useNavigationStore((s) => s.setPage);

  return (
    <nav className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5">
      {NAV_ITEMS.map((item) => {
        const active = page === item.page;
        return (
          <button
            key={item.page}
            onClick={() => setPage(item.page)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Header() {
  const dataset = useDatasetStore((s) => s.dataset);
  const resetDataset = useDatasetStore((s) => s.resetDataset);

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-accent-foreground shadow-soft">
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="hidden whitespace-nowrap leading-tight lg:block">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Datalyst
            </p>
            <p className="text-[11px] text-muted-foreground">Collecte &amp; nettoyage des données</p>
          </div>
        </div>

        <NavTabs />

        {dataset && (
          <div className="hidden min-w-0 flex-1 items-center justify-start gap-2 overflow-hidden text-sm text-muted-foreground 2xl:flex">
            <span className="truncate font-medium text-foreground" title={dataset.fileName}>
              {dataset.fileName}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-border" aria-hidden />
            <span className="shrink-0 tabular-nums">
              {formatNumber(dataset.rows.length)} lignes · {formatNumber(dataset.columns.length)} colonnes
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {dataset && (
            <>
              <Button variant="ghost" size="sm" onClick={resetDataset} className="hidden sm:inline-flex">
                <RotateCcw />
                <span className="hidden md:inline">Nouveau fichier</span>
              </Button>
              <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
              <ExportMenu />
              <Separator orientation="vertical" className="mx-0.5 h-6" />
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
