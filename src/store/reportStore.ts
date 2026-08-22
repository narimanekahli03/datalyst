import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ReportBlock, ReportBlockType, TableRowLimit, TextBlock } from "@/types/report";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function createBlock(type: ReportBlockType): ReportBlock {
  const id = nanoid();
  switch (type) {
    case "text":
      return { id, type: "text", heading: "", content: "" };
    case "chart":
      return { id, type: "chart", chartId: null };
    case "kpi":
      return { id, type: "kpi" };
    case "table":
      return { id, type: "table", maxRows: 20 };
    case "insights":
      return { id, type: "insights" };
    case "query":
      return { id, type: "query", queryEntryId: null };
  }
}

interface ReportStore {
  title: string;
  subtitle: string;
  date: string;
  logoDataUrl: string | null;
  blocks: ReportBlock[];

  setTitle: (title: string) => void;
  setSubtitle: (subtitle: string) => void;
  setDate: (date: string) => void;
  setLogo: (dataUrl: string | null) => void;

  addBlock: (type: ReportBlockType) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, direction: "up" | "down") => void;

  updateTextBlock: (id: string, patch: Partial<Pick<TextBlock, "heading" | "content">>) => void;
  setChartBlockChart: (id: string, chartId: string) => void;
  setTableBlockMaxRows: (id: string, maxRows: TableRowLimit) => void;
  setQueryBlockEntry: (id: string, queryEntryId: string) => void;

  resetReport: () => void;
}

const INITIAL_STATE = {
  title: "Rapport d'analyse",
  subtitle: "",
  date: todayIso(),
  logoDataUrl: null as string | null,
  blocks: [] as ReportBlock[],
};

export const useReportStore = create<ReportStore>((set) => ({
  ...INITIAL_STATE,

  setTitle: (title) => set({ title }),
  setSubtitle: (subtitle) => set({ subtitle }),
  setDate: (date) => set({ date }),
  setLogo: (logoDataUrl) => set({ logoDataUrl }),

  addBlock: (type) => set((state) => ({ blocks: [...state.blocks, createBlock(type)] })),

  removeBlock: (id) => set((state) => ({ blocks: state.blocks.filter((b) => b.id !== id) })),

  moveBlock: (id, direction) =>
    set((state) => {
      const blocks = [...state.blocks];
      const index = blocks.findIndex((b) => b.id === id);
      if (index === -1) return state;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= blocks.length) return state;
      [blocks[index], blocks[targetIndex]] = [blocks[targetIndex], blocks[index]];
      return { blocks };
    }),

  updateTextBlock: (id, patch) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id && b.type === "text" ? { ...b, ...patch } : b)),
    })),

  setChartBlockChart: (id, chartId) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id && b.type === "chart" ? { ...b, chartId } : b)),
    })),

  setTableBlockMaxRows: (id, maxRows) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id && b.type === "table" ? { ...b, maxRows } : b)),
    })),

  setQueryBlockEntry: (id, queryEntryId) =>
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id && b.type === "query" ? { ...b, queryEntryId } : b)),
    })),

  resetReport: () => set({ ...INITIAL_STATE, date: todayIso(), blocks: [] }),
}));
