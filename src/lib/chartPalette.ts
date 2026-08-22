/**
 * Fixed-order categorical palette (validated for CVD-safety in both modes —
 * see the dataviz skill's palette.md). Never cycle or generate extra hues;
 * past MAX_SERIES, fold the tail into "Autres" instead.
 */
const CATEGORICAL_LIGHT = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

export const MAX_SERIES = CATEGORICAL_LIGHT.length;

export function getCategoricalPalette(isDark: boolean): string[] {
  return isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
}

export function seriesColor(index: number, isDark: boolean): string {
  const palette = getCategoricalPalette(isDark);
  return palette[index % palette.length];
}

/** Chart chrome (grid/axis/text) — plain hex so exported PNGs render correctly standalone. */
export function chartChrome(isDark: boolean) {
  return {
    ink: isDark ? "#ffffff" : "#0b0b0b",
    secondaryInk: isDark ? "#c3c2b7" : "#52514e",
    mutedInk: "#898781",
    grid: isDark ? "#2c2c2a" : "#e1e0d9",
    axisLine: isDark ? "#383835" : "#c3c2b7",
    surface: isDark ? "#1a1a19" : "#fcfcfb",
    tooltipBorder: isDark ? "rgba(255,255,255,0.10)" : "rgba(11,11,11,0.10)",
  };
}

export const OTHER_LABEL = "Autres";
