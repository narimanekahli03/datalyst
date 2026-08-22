import { useMemo } from "react";
import type { CorrelationPair } from "@/types/explore";
import { useTheme } from "@/hooks/useTheme";
import { formatDecimal } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const STRONG_THRESHOLD = 0.7;
const MODERATE_THRESHOLD = 0.4;

const NEUTRAL = { light: [240, 239, 236], dark: [56, 56, 53] } as const;
const NEGATIVE = { light: [42, 120, 214], dark: [57, 135, 229] } as const; // blue
const POSITIVE = { light: [227, 73, 72], dark: [230, 103, 103] } as const; // red

function correlationCellStyle(r: number, isDark: boolean): { background: string; color: string } {
  const neutral = isDark ? NEUTRAL.dark : NEUTRAL.light;
  const pole = r >= 0 ? (isDark ? POSITIVE.dark : POSITIVE.light) : isDark ? NEGATIVE.dark : NEGATIVE.light;
  const t = Math.min(1, Math.abs(r));
  const rgb = neutral.map((channel, i) => Math.round(channel + (pole[i] - channel) * t));
  return {
    background: `rgb(${rgb.join(",")})`,
    color: isDark ? "#ffffff" : t > 0.5 ? "#ffffff" : "#0b0b0b",
  };
}

interface CorrelationMatrixProps {
  columns: string[];
  correlations: CorrelationPair[];
}

export function CorrelationMatrix({ columns, correlations }: CorrelationMatrixProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const lookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const pair of correlations) {
      map.set(`${pair.columnA}|${pair.columnB}`, pair.r);
      map.set(`${pair.columnB}|${pair.columnA}`, pair.r);
    }
    return map;
  }, [correlations]);

  const strongPairs = useMemo(
    () =>
      [...correlations]
        .filter((p) => Math.abs(p.r) >= MODERATE_THRESHOLD)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r)),
    [correlations]
  );

  if (columns.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Corrélations</CardTitle>
          <CardDescription>Au moins deux colonnes numériques sont nécessaires.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrélations entre colonnes numériques</CardTitle>
        <CardDescription>Coefficient de Pearson, de -1 (opposé) à +1 (lié).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="p-0" />
                {columns.map((col) => (
                  <th
                    key={col}
                    className="max-w-[72px] truncate px-1 pb-1 text-center font-medium text-muted-foreground"
                    title={col}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((rowCol) => (
                <tr key={rowCol}>
                  <th
                    className="max-w-[120px] truncate pr-2 text-right font-medium text-muted-foreground"
                    title={rowCol}
                  >
                    {rowCol}
                  </th>
                  {columns.map((colCol) => {
                    const r = rowCol === colCol ? 1 : lookup.get(`${rowCol}|${colCol}`);
                    if (r === undefined) {
                      return (
                        <td
                          key={colCol}
                          className="h-9 w-14 rounded-md bg-secondary/30 text-center text-muted-foreground"
                        >
                          -
                        </td>
                      );
                    }
                    const style = correlationCellStyle(r, isDark);
                    const isStrong = rowCol !== colCol && Math.abs(r) >= STRONG_THRESHOLD;
                    return (
                      <td
                        key={colCol}
                        style={style}
                        className={
                          "h-9 w-14 rounded-md text-center font-medium tabular-nums" +
                          (isStrong ? " ring-2 ring-foreground/40" : "")
                        }
                        title={`${rowCol} ↔ ${colCol} : r = ${formatDecimal(r, 2)}`}
                      >
                        {formatDecimal(r, 2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {strongPairs.length > 0 ? (
          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Corrélations notables
            </p>
            <ul className="space-y-1">
              {strongPairs.slice(0, 6).map((pair) => (
                <li
                  key={`${pair.columnA}-${pair.columnB}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-foreground">
                    {pair.columnA} ↔ {pair.columnB}
                  </span>
                  <span
                    className={
                      "shrink-0 tabular-nums " +
                      (Math.abs(pair.r) >= STRONG_THRESHOLD ? "font-semibold text-foreground" : "text-muted-foreground")
                    }
                  >
                    r = {formatDecimal(pair.r, 2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            Aucune corrélation notable (≥ 0,4) détectée entre les colonnes numériques.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
