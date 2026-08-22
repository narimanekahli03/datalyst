import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ReportBlock, ReportConfig } from "@/types/report";
import type { ChartConfig, KpiConfig } from "@/types/dashboard";
import type { Dataset } from "@/types/dataset";
import type { Insight } from "@/types/insights";
import type { TextToSqlHistoryEntry } from "@/types/textToSql";
import { computeKpiValue, isKpiFieldMissing } from "@/lib/chartData";
import { formatCellValue } from "@/lib/columnTypeMeta";

/** Row/column caps for an embedded query result, matching the screen preview. */
const QUERY_BLOCK_MAX_ROWS = 10;
const QUERY_BLOCK_MAX_COLUMNS = 8;

const INK = "#0b0b0b";
const SECONDARY_INK = "#52514e";
const MUTED_INK = "#898781";
const BORDER = "#e1e0d9";
const TINT = "#f0efec";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 10,
    color: SECONDARY_INK,
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 16,
    marginBottom: 20,
  },
  // Times-Bold is one of the 14 base PDF fonts — always available, no
  // registration/embedding needed. Serif title against the sans body text
  // mirrors the same editorial pairing used on-screen.
  title: { fontSize: 24, fontFamily: "Times-Bold", color: INK },
  subtitle: { fontSize: 12, color: SECONDARY_INK, marginTop: 4 },
  date: { fontSize: 9, color: MUTED_INK, marginTop: 6 },
  logo: { width: 46, height: 46, objectFit: "contain" },

  block: { marginBottom: 18 },
  blockHeading: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 6 },
  paragraph: { fontSize: 10, lineHeight: 1.55, color: SECONDARY_INK },

  chartBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 10 },
  chartTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 8 },
  chartImage: { width: "100%" },

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    width: "23%",
    alignItems: "center",
  },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: INK },
  kpiLabel: { fontSize: 7.5, color: MUTED_INK, marginTop: 3, textAlign: "center" },

  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: TINT },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BORDER },
  tableCellHeader: {
    flex: 1,
    flexBasis: 0,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: INK,
    paddingVertical: 5,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  tableCell: {
    flex: 1,
    flexBasis: 0,
    fontSize: 8.5,
    color: SECONDARY_INK,
    paddingVertical: 4,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  tableNote: { fontSize: 8, color: MUTED_INK, marginTop: 4 },

  insightsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  insightBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
  },
  insightText: { fontSize: 9, lineHeight: 1.4, color: SECONDARY_INK },

  sqlBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    backgroundColor: TINT,
    padding: 8,
    marginBottom: 8,
  },
  sqlText: { fontSize: 8, fontFamily: "Courier", color: INK },

  placeholder: {
    fontSize: 9,
    color: MUTED_INK,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: MUTED_INK,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

export interface ChartImageData {
  dataUrl: string;
  aspectRatio: number;
}

interface ReportDocumentProps {
  report: ReportConfig;
  dataset: Dataset;
  charts: ChartConfig[];
  kpis: KpiConfig[];
  insights: Insight[];
  queryHistory: TextToSqlHistoryEntry[];
  chartImages: Record<string, ChartImageData>;
}

function formatReportDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    date
  );
}

function renderBlock(
  block: ReportBlock,
  dataset: Dataset,
  charts: ChartConfig[],
  kpis: KpiConfig[],
  insights: Insight[],
  queryHistory: TextToSqlHistoryEntry[],
  chartImages: Record<string, ChartImageData>
) {
  if (block.type === "text") {
    if (!block.heading && !block.content) return null;
    return (
      <View style={styles.block} key={block.id} wrap={false}>
        {block.heading && <Text style={styles.blockHeading}>{block.heading}</Text>}
        {block.content && <Text style={styles.paragraph}>{block.content}</Text>}
      </View>
    );
  }

  if (block.type === "chart") {
    const chart = charts.find((c) => c.id === block.chartId);
    const image = chartImages[block.id];
    if (!chart) return null;
    return (
      <View style={styles.block} key={block.id} wrap={false}>
        <View style={styles.chartBox}>
          <Text style={styles.chartTitle}>{chart.title}</Text>
          {image ? (
            <Image
              src={image.dataUrl}
              style={{ ...styles.chartImage, height: 320 / image.aspectRatio }}
            />
          ) : (
            <Text style={styles.placeholder}>Image du graphique indisponible.</Text>
          )}
        </View>
      </View>
    );
  }

  if (block.type === "kpi") {
    if (kpis.length === 0) return null;
    return (
      <View style={styles.block} key={block.id} wrap={false}>
        <View style={styles.kpiRow}>
          {kpis.map((kpi) => {
            const missing = isKpiFieldMissing(dataset, kpi);
            const value = missing ? null : computeKpiValue(dataset, kpi);
            return (
              <View style={styles.kpiBox} key={kpi.id}>
                <Text style={styles.kpiValue}>
                  {value === null ? "-" : new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}
                </Text>
                <Text style={styles.kpiLabel}>{kpi.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (block.type === "insights") {
    if (insights.length === 0) return null;
    return (
      <View style={styles.block} key={block.id} wrap={false}>
        <View style={styles.insightsGrid}>
          {insights.map((insight, i) => (
            <View style={styles.insightBox} key={i}>
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (block.type === "query") {
    const entry = queryHistory.find((h) => h.id === block.queryEntryId);
    if (!entry) return null;
    const columns = entry.result.columns.slice(0, QUERY_BLOCK_MAX_COLUMNS);
    const rows = entry.result.rows.slice(0, QUERY_BLOCK_MAX_ROWS);
    return (
      <View style={styles.block} key={block.id} wrap={false}>
        <Text style={styles.blockHeading}>{entry.question}</Text>
        <Text style={{ ...styles.paragraph, marginBottom: 8 }}>{entry.summary}</Text>
        <View style={styles.sqlBox}>
          <Text style={styles.sqlText}>{entry.sql}</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {columns.map((col) => (
              <Text style={styles.tableCellHeader} key={col}>
                {col}
              </Text>
            ))}
          </View>
          {rows.map((row, i) => (
            <View style={styles.tableRow} key={i}>
              {columns.map((col) => (
                <Text style={styles.tableCell} key={col}>
                  {formatCellValue(row[col] ?? null)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // table
  const columns = dataset.columns.slice(0, 8);
  const rows = dataset.rows.slice(0, block.maxRows);
  return (
    <View style={styles.block} key={block.id} wrap={false}>
      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          {columns.map((col) => (
            <Text style={styles.tableCellHeader} key={col.name}>
              {col.name}
            </Text>
          ))}
        </View>
        {rows.map((row) => (
          <View style={styles.tableRow} key={row.__rowId}>
            {columns.map((col) => (
              <Text style={styles.tableCell} key={col.name}>
                {formatCellValue(row[col.name] ?? null)}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <Text style={styles.tableNote}>
        {rows.length} sur {dataset.rows.length} ligne(s) affichée(s)
        {dataset.columns.length > columns.length
          ? ` · ${columns.length} sur ${dataset.columns.length} colonnes`
          : ""}
      </Text>
    </View>
  );
}

export function ReportDocument({
  report,
  dataset,
  charts,
  kpis,
  insights,
  queryHistory,
  chartImages,
}: ReportDocumentProps) {
  return (
    <Document title={report.title || "Rapport"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{report.title || "Rapport d'analyse"}</Text>
            {report.subtitle ? <Text style={styles.subtitle}>{report.subtitle}</Text> : null}
            <Text style={styles.date}>{formatReportDate(report.date)}</Text>
          </View>
          {report.logoDataUrl ? <Image src={report.logoDataUrl} style={styles.logo} /> : null}
        </View>

        {report.blocks.map((block) =>
          renderBlock(block, dataset, charts, kpis, insights, queryHistory, chartImages)
        )}

        <View style={styles.footer} fixed>
          <Text>Datalyst</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
