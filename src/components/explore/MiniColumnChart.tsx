import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { HistogramBin } from "@/types/explore";
import { chartChrome, getCategoricalPalette } from "@/lib/chartPalette";

interface MiniColumnChartProps {
  data: HistogramBin[];
  isDark: boolean;
  height?: number;
}

function MiniChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: HistogramBin }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2 py-1 text-[11px] shadow-elevated">
      <span className="font-medium text-foreground">{point.label}</span>
      <span className="ml-1.5 tabular-nums text-muted-foreground">· {point.count}</span>
    </div>
  );
}

/** Discreet sparkline-style bar chart. Only the first and last bin are
 *  labelled directly (the span), so the chart reads without needing to
 *  hover; hovering a bar still gives its exact range and count. Used for
 *  numeric histograms and date timelines. */
export function MiniColumnChart({ data, isDark, height = 68 }: MiniColumnChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>
        Pas de donnée
      </div>
    );
  }

  const color = getCategoricalPalette(isDark)[0];
  const chrome = chartChrome(isDark);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: chrome.mutedInk }}
          tickLine={false}
          axisLine={{ stroke: chrome.axisLine }}
          interval={0}
          height={16}
          tickFormatter={(value: string, index: number) =>
            index === 0 || index === data.length - 1 ? value : ""
          }
        />
        <Tooltip content={<MiniChartTooltip />} cursor={{ fill: color, opacity: 0.08 }} />
        <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
