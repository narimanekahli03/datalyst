import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChartConfig, DashboardViewMode, KpiConfig } from "@/types/dashboard";

interface DashboardStore {
  charts: ChartConfig[];
  kpis: KpiConfig[];
  viewMode: DashboardViewMode;
  /** Column name requested from another page (e.g. Explore) to seed the chart builder. */
  seedColumn: string | null;

  setViewMode: (mode: DashboardViewMode) => void;
  requestChartForColumn: (columnName: string) => void;
  clearSeedColumn: () => void;

  addChart: (config: Omit<ChartConfig, "id" | "createdAt">) => void;
  updateChartTitle: (id: string, title: string) => void;
  removeChart: (id: string) => void;
  duplicateChart: (id: string) => void;

  addKpi: (kpi: Omit<KpiConfig, "id">) => void;
  removeKpi: (id: string) => void;

  resetDashboard: () => void;
}

const DEFAULT_KPIS: KpiConfig[] = [
  { id: "default-row-count", label: "Nombre de lignes", field: null, aggregation: "count" },
];

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  charts: [],
  kpis: DEFAULT_KPIS,
  viewMode: "charts",
  seedColumn: null,

  setViewMode: (mode) => set({ viewMode: mode }),
  requestChartForColumn: (columnName) => set({ seedColumn: columnName, viewMode: "charts" }),
  clearSeedColumn: () => set({ seedColumn: null }),

  addChart: (config) =>
    set((state) => ({
      charts: [...state.charts, { ...config, id: nanoid(), createdAt: Date.now() }],
    })),

  updateChartTitle: (id, title) =>
    set((state) => ({
      charts: state.charts.map((c) => (c.id === id ? { ...c, title } : c)),
    })),

  removeChart: (id) =>
    set((state) => ({ charts: state.charts.filter((c) => c.id !== id) })),

  duplicateChart: (id) => {
    const chart = get().charts.find((c) => c.id === id);
    if (!chart) return;
    set((state) => ({
      charts: [
        ...state.charts,
        { ...chart, id: nanoid(), title: `${chart.title} (copie)`, createdAt: Date.now() },
      ],
    }));
  },

  addKpi: (kpi) =>
    set((state) => ({ kpis: [...state.kpis, { ...kpi, id: nanoid() }] })),

  removeKpi: (id) =>
    set((state) => ({ kpis: state.kpis.filter((k) => k.id !== id) })),

  resetDashboard: () =>
    set({ charts: [], kpis: DEFAULT_KPIS, viewMode: "charts", seedColumn: null }),
}));
