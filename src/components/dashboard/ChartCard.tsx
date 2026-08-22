import { useMemo, useRef, useState } from "react";
import { Copy, Download, MoreVertical, Trash2 } from "lucide-react";
import type { ChartConfig } from "@/types/dashboard";
import type { Dataset } from "@/types/dataset";
import { useDashboardStore } from "@/store/dashboardStore";
import { useTheme } from "@/hooks/useTheme";
import { exportChartAsPng } from "@/lib/exportChartImage";
import { buildChartData } from "@/lib/chartData";
import { chartChrome } from "@/lib/chartPalette";
import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChartCardProps {
  chart: ChartConfig;
  dataset: Dataset;
}

export function ChartCard({ chart, dataset }: ChartCardProps) {
  const updateChartTitle = useDashboardStore((s) => s.updateChartTitle);
  const removeChart = useDashboardStore((s) => s.removeChart);
  const duplicateChart = useDashboardStore((s) => s.duplicateChart);
  const { theme } = useTheme();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chart.title);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  const series = useMemo(
    () => buildChartData(dataset, chart, isDark).series,
    [dataset, chart, isDark]
  );

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed !== "") updateChartTitle(chart.id, trimmed);
    setIsEditingTitle(false);
  };

  const handleExport = async () => {
    if (!containerRef.current) return;
    const chrome = chartChrome(isDark);
    // A single-series chart's color is already obvious from the chart itself
    // (and pie/scatter always need their legend to make sense of the slices).
    const legend =
      series.length > 1 || chart.type === "pie"
        ? series.map((s) => ({ label: s.label, color: s.color }))
        : [];
    try {
      await exportChartAsPng(
        containerRef.current,
        chart.title.replace(/\s+/g, "_"),
        chrome.surface,
        chrome.ink,
        legend
      );
    } catch {
      // Nothing plottable yet (e.g. missing column) — exporting is simply a no-op.
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        {isEditingTitle ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(chart.title);
                setIsEditingTitle(false);
              }
            }}
            className="h-7 text-sm font-semibold"
          />
        ) : (
          <button
            onClick={() => {
              setTitleDraft(chart.title);
              setIsEditingTitle(true);
            }}
            title="Renommer le graphique"
            className="min-w-0 truncate text-left text-sm font-semibold text-foreground transition-colors hover:text-accent"
          >
            {chart.title}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleExport}>
              <Download />
              Exporter en PNG
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => duplicateChart(chart.id)}>
              <Copy />
              Dupliquer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => removeChart(chart.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <ChartRenderer ref={containerRef} config={chart} dataset={dataset} />
      </CardContent>
    </Card>
  );
}
