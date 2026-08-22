import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { QueryResult } from "@/types/textToSql";
import type { AutoChartSpec } from "@/lib/textToSql/autoChart";
import { getCategoricalPalette, chartChrome } from "@/lib/chartPalette";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface QueryResultChartProps {
  result: QueryResult;
  spec: AutoChartSpec;
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number; color?: string }[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-elevated">
      {label !== undefined && (
        <p className="mb-1 max-w-[14rem] truncate font-medium text-foreground">{String(label)}</p>
      )}
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: payload[0].color }} />
        <span className="font-medium tabular-nums text-foreground">{formatNumber(payload[0].value ?? 0)}</span>
      </div>
    </div>
  );
}

export function QueryResultChart({ result, spec }: QueryResultChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chrome = useMemo(() => chartChrome(isDark), [isDark]);
  const color = getCategoricalPalette(isDark)[0];

  const data = result.rows.map((row) => ({
    [spec.xKey]: row[spec.xKey] === null ? "-" : String(row[spec.xKey]),
    [spec.yKey]: typeof row[spec.yKey] === "number" ? row[spec.yKey] : 0,
  }));

  const axisTick = { fill: chrome.mutedInk, fontSize: 12 };

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chrome.grid} vertical={false} />
          <XAxis
            dataKey={spec.xKey}
            tick={axisTick}
            axisLine={{ stroke: chrome.axisLine }}
            tickLine={false}
          />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCompactNumber(Number(v))}
          />
          <Tooltip content={<ChartTooltipContent />} cursor={{ fill: chrome.grid, opacity: 0.4 }} />
          <Bar
            dataKey={spec.yKey}
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
