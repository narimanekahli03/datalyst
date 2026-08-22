import {
  BarChart3,
  Bot,
  ChevronDown,
  ChevronUp,
  Gauge,
  Sparkles,
  Table2,
  Text as TextIcon,
  Trash2,
} from "lucide-react";
import type { ReportBlock, ReportBlockType, TableRowLimit } from "@/types/report";
import { useReportStore } from "@/store/reportStore";
import { useDashboardStore } from "@/store/dashboardStore";
import { useTextToSqlStore } from "@/store/textToSqlStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const BLOCK_TYPE_META: Record<ReportBlockType, { label: string; icon: typeof TextIcon }> = {
  text: { label: "Texte", icon: TextIcon },
  chart: { label: "Graphique", icon: BarChart3 },
  kpi: { label: "Indicateurs", icon: Gauge },
  table: { label: "Tableau de données", icon: Table2 },
  insights: { label: "Insights IA", icon: Sparkles },
  query: { label: "Question IA", icon: Bot },
};

const ADD_ORDER: ReportBlockType[] = ["text", "chart", "kpi", "table", "insights", "query"];
const TABLE_ROW_OPTIONS: TableRowLimit[] = [10, 20, 50];

function TextBlockFields({ block }: { block: Extract<ReportBlock, { type: "text" }> }) {
  const updateTextBlock = useReportStore((s) => s.updateTextBlock);
  return (
    <div className="space-y-2">
      <Input
        value={block.heading}
        onChange={(e) => updateTextBlock(block.id, { heading: e.target.value })}
        placeholder="Titre de la section (optionnel)"
        className="text-sm font-medium"
      />
      <Textarea
        value={block.content}
        onChange={(e) => updateTextBlock(block.id, { content: e.target.value })}
        placeholder="Introduction, analyse, commentaire…"
        rows={4}
        className="text-sm"
      />
    </div>
  );
}

function ChartBlockFields({ block }: { block: Extract<ReportBlock, { type: "chart" }> }) {
  const charts = useDashboardStore((s) => s.charts);
  const setChartBlockChart = useReportStore((s) => s.setChartBlockChart);

  if (charts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucun graphique disponible. Créez-en un sur le tableau de bord d'abord.
      </p>
    );
  }

  return (
    <Select value={block.chartId ?? undefined} onValueChange={(v) => setChartBlockChart(block.id, v)}>
      <SelectTrigger>
        <SelectValue placeholder="Choisir un graphique" />
      </SelectTrigger>
      <SelectContent>
        {charts.map((chart) => (
          <SelectItem key={chart.id} value={chart.id}>
            {chart.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TableBlockFields({ block }: { block: Extract<ReportBlock, { type: "table" }> }) {
  const setTableBlockMaxRows = useReportStore((s) => s.setTableBlockMaxRows);
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs font-normal text-muted-foreground">Lignes affichées</Label>
      <Select
        value={String(block.maxRows)}
        onValueChange={(v) => setTableBlockMaxRows(block.id, Number(v) as TableRowLimit)}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TABLE_ROW_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function QueryBlockFields({ block }: { block: Extract<ReportBlock, { type: "query" }> }) {
  const history = useTextToSqlStore((s) => s.history);
  const setQueryBlockEntry = useReportStore((s) => s.setQueryBlockEntry);

  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucune question posée. Utilisez la page Interroger d'abord.
      </p>
    );
  }

  return (
    <Select value={block.queryEntryId ?? undefined} onValueChange={(v) => setQueryBlockEntry(block.id, v)}>
      <SelectTrigger>
        <SelectValue placeholder="Choisir une question" />
      </SelectTrigger>
      <SelectContent>
        {history.map((entry) => (
          <SelectItem key={entry.id} value={entry.id}>
            <span className="block max-w-[240px] truncate">{entry.question}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReportBlockList() {
  const blocks = useReportStore((s) => s.blocks);
  const addBlock = useReportStore((s) => s.addBlock);
  const removeBlock = useReportStore((s) => s.removeBlock);
  const moveBlock = useReportStore((s) => s.moveBlock);
  const chartsAvailable = useDashboardStore((s) => s.charts.length > 0);
  const queryHistoryAvailable = useTextToSqlStore((s) => s.history.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocs du rapport</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-1.5">
          {ADD_ORDER.map((type) => {
            const meta = BLOCK_TYPE_META[type];
            const disabled =
              (type === "chart" && !chartsAvailable) || (type === "query" && !queryHistoryAvailable);
            const button = (
              <Button
                key={type}
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={disabled}
                onClick={() => addBlock(type)}
              >
                <meta.icon />
                <span className="truncate">{meta.label}</span>
              </Button>
            );
            if (!disabled) return button;
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <span>{button}</span>
                </TooltipTrigger>
                <TooltipContent>
                  {type === "chart"
                    ? "Créez d'abord un graphique sur le tableau de bord"
                    : "Posez d'abord une question sur la page Interroger"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {blocks.length === 0 ? (
          <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            Ajoutez un bloc pour commencer à construire votre rapport.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {blocks.map((block, index) => {
              const meta = BLOCK_TYPE_META[block.type];
              return (
                <li key={block.id} className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <meta.icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() => moveBlock(block.id, "up")}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === blocks.length - 1}
                        onClick={() => moveBlock(block.id, "down")}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-6 w-6 text-muted-foreground hover:text-destructive")}
                        onClick={() => removeBlock(block.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {block.type === "text" && <TextBlockFields block={block} />}
                  {block.type === "chart" && <ChartBlockFields block={block} />}
                  {block.type === "table" && <TableBlockFields block={block} />}
                  {block.type === "query" && <QueryBlockFields block={block} />}
                  {block.type === "kpi" && (
                    <p className="text-xs text-muted-foreground">
                      Affiche tous les indicateurs actuels du tableau de bord.
                    </p>
                  )}
                  {block.type === "insights" && (
                    <p className="text-xs text-muted-foreground">
                      Affiche les observations IA générées sur la page Nettoyage.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
