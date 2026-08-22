function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface LegendItem {
  label: string;
  color: string;
}

const LEGEND_FONT = "12px Inter, ui-sans-serif, system-ui, sans-serif";
const LEGEND_ROW_HEIGHT = 24;
const LEGEND_SWATCH = 10;
const LEGEND_PADDING_X = 16;
const LEGEND_PADDING_Y = 10;
const LEGEND_ITEM_GAP = 18;

/** Draws a wrapping color-swatch legend below the chart — Recharts' own
 *  legend is a plain HTML sibling, not part of the SVG, so it has to be
 *  reconstructed manually to appear in the exported image. */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  legend: LegendItem[],
  width: number,
  top: number,
  textColor: string
): number {
  ctx.font = LEGEND_FONT;
  ctx.textBaseline = "middle";

  let x = LEGEND_PADDING_X;
  let y = top + LEGEND_PADDING_Y + LEGEND_ROW_HEIGHT / 2;
  let rows = 1;

  for (const item of legend) {
    const textWidth = ctx.measureText(item.label).width;
    const itemWidth = LEGEND_SWATCH + 6 + textWidth;

    if (x + itemWidth > width - LEGEND_PADDING_X && x > LEGEND_PADDING_X) {
      x = LEGEND_PADDING_X;
      y += LEGEND_ROW_HEIGHT;
      rows += 1;
    }

    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - LEGEND_SWATCH / 2, LEGEND_SWATCH, LEGEND_SWATCH);
    ctx.fillStyle = textColor;
    ctx.fillText(item.label, x + LEGEND_SWATCH + 6, y + 1);

    x += itemWidth + LEGEND_ITEM_GAP;
  }

  return LEGEND_PADDING_Y * 2 + rows * LEGEND_ROW_HEIGHT;
}

/**
 * Serializes the chart's rendered SVG onto an offscreen canvas and downloads
 * it as PNG. No extra dependency (no html2canvas) — Recharts already gives us
 * a clean, self-contained SVG to work with. The legend (Recharts renders it
 * as a plain HTML sibling, not inside the SVG) is redrawn manually below the
 * chart from the same series data driving the on-screen legend.
 */
export async function exportChartAsPng(
  container: HTMLElement,
  fileName: string,
  backgroundColor: string,
  textColor: string,
  legend: LegendItem[] = []
): Promise<void> {
  // Recharts renders one small `<svg class="recharts-surface">` per legend
  // swatch in addition to the actual chart surface — querySelector("svg")
  // would grab whichever comes first, which is often a legend icon. Pick the
  // largest by area instead; the real chart is always far bigger than a swatch.
  const svg = [...container.querySelectorAll("svg")].sort((a, b) => {
    const areaOf = (el: SVGSVGElement) => {
      const r = el.getBoundingClientRect();
      return r.width * r.height;
    };
    return areaOf(b) - areaOf(a);
  })[0];
  if (!svg) throw new Error("Aucun graphique à exporter.");

  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // The live element has an inline `width:100%;height:100%` (Recharts fills
  // its container that way) — harmless in the DOM, but once serialized as a
  // standalone image there's no container for those percentages to resolve
  // against, which produced an inconsistently-scaled/cropped rasterization.
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de préparer l'image du graphique."));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Export impossible sur ce navigateur.");

    // Measure the legend block height (unscaled) before sizing the canvas.
    ctx.font = LEGEND_FONT;
    const legendHeight =
      legend.length > 0
        ? (() => {
            let x = LEGEND_PADDING_X;
            let rows = 1;
            for (const item of legend) {
              const w = LEGEND_SWATCH + 6 + ctx.measureText(item.label).width;
              if (x + w > width - LEGEND_PADDING_X && x > LEGEND_PADDING_X) {
                x = LEGEND_PADDING_X;
                rows += 1;
              }
              x += w + LEGEND_ITEM_GAP;
            }
            return LEGEND_PADDING_Y * 2 + rows * LEGEND_ROW_HEIGHT;
          })()
        : 0;

    const totalHeight = height + legendHeight;
    canvas.width = width * scale;
    canvas.height = totalHeight * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, totalHeight);
    ctx.drawImage(image, 0, 0, width, height);

    if (legend.length > 0) {
      drawLegend(ctx, legend, width, height, textColor);
    }

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Export impossible.");
    triggerDownload(blob, `${fileName}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
