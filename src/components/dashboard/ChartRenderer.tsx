import { forwardRef, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle } from "lucide-react";
import type { ChartConfig } from "@/types/dashboard";
import type { Dataset } from "@/types/dataset";
import { buildChartData } from "@/lib/chartData";
import { chartChrome } from "@/lib/chartPalette";
import { formatCompactNumber, formatNumber } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface TooltipPayloadEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-elevated">
      {label !== undefined && (
        <p className="mb-1 max-w-[14rem] truncate font-medium text-foreground">{String(label)}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={`${entry.dataKey ?? index}`} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {formatNumber(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChartRendererProps {
  config: ChartConfig;
  dataset: Dataset;
  compact?: boolean;
  /** Renders with light-mode colors regardless of the app's current theme —
   *  used by the report preview, which is a fixed white "paper" surface
   *  meant to mirror the (always white) exported PDF, not the app chrome. */
  forceLight?: boolean;
}

export const ChartRenderer = forwardRef<HTMLDivElement, ChartRendererProps>(
  ({ config, dataset, compact = false, forceLight = false }, ref) => {
    const { theme } = useTheme();
    const isDark = forceLight ? false : theme === "dark";
    const chrome = useMemo(() => chartChrome(isDark), [isDark]);

    const renderData = useMemo(
      () => buildChartData(dataset, config, isDark),
      [dataset, config, isDark]
    );

    if (renderData.missingColumns.length > 0) {
      return (
        <div
          ref={ref}
          className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 px-6 text-center"
        >
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Colonne(s) introuvable(s) : {renderData.missingColumns.join(", ")}
          </p>
        </div>
      );
    }

    if (!config.xField || config.yFields.length === 0 || renderData.isEmpty) {
      return (
        <div
          ref={ref}
          className="flex h-full min-h-[220px] flex-col items-center justify-center gap-1 px-6 text-center"
        >
          <p className="text-sm text-muted-foreground">Aucune donnée à afficher.</p>
        </div>
      );
    }

    const axisTick = { fill: chrome.mutedInk, fontSize: 12 };
    const height = compact ? 220 : 280;
    const legend = config.yFields.length > 1 || (config.groupByField && renderData.series.length > 1);

    return (
      <div ref={ref} style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {config.type === "line" ? (
            <LineChart data={renderData.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chrome.grid} vertical={false} />
              <XAxis
                dataKey={renderData.xKey}
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
              <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: chrome.grid }} />
              {legend && <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />}
              {renderData.series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : config.type === "area" ? (
            <AreaChart data={renderData.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chrome.grid} vertical={false} />
              <XAxis
                dataKey={renderData.xKey}
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
              <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: chrome.grid }} />
              {legend && <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />}
              {renderData.series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={0.14}
                  stackId={config.groupByField ? "stack" : undefined}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : config.type === "bar" ? (
            <BarChart data={renderData.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chrome.grid} vertical={false} />
              <XAxis
                dataKey={renderData.xKey}
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
              <Tooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: chrome.grid, opacity: 0.4 }}
              />
              {legend && <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />}
              {renderData.series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                  stackId={config.groupByField ? "stack" : undefined}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : config.type === "pie" ? (
            <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <Tooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />
              <Pie
                data={renderData.data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={compact ? 70 : 90}
                strokeWidth={2}
                stroke={chrome.surface}
                isAnimationActive={false}
              >
                {renderData.series.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chrome.grid} />
              <XAxis
                type="number"
                dataKey="x"
                name={config.xField ?? ""}
                tick={axisTick}
                axisLine={{ stroke: chrome.axisLine }}
                tickLine={false}
                tickFormatter={(v) => formatCompactNumber(Number(v))}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={config.yFields[0] ?? ""}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactNumber(Number(v))}
              />
              <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: chrome.grid }} />
              {legend && <Legend wrapperStyle={{ fontSize: 12, color: chrome.secondaryInk }} />}
              {renderData.series.map((s) => (
                <Scatter
                  key={s.key}
                  name={s.label}
                  data={renderData.data.filter((d) => d.series === s.key)}
                  fill={s.color}
                  fillOpacity={0.75}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  }
);

ChartRenderer.displayName = "ChartRenderer";
