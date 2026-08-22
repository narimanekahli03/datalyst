import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  ColumnType,
  Dataset,
  HistoryEntry,
  MissingValueStrategy,
  OperationResult,
} from "@/types/dataset";
import { FileParseError, parseFile } from "@/lib/fileParser";
import { useDashboardStore } from "@/store/dashboardStore";
import { useReportStore } from "@/store/reportStore";
import { useTextToSqlStore } from "@/store/textToSqlStore";
import { useInsightsStore } from "@/store/insightsStore";
import {
  convertColumnType as opConvertColumnType,
  deleteColumn as opDeleteColumn,
  handleMissingValues as opHandleMissingValues,
  redetectTypes,
  removeDuplicateRows as opRemoveDuplicateRows,
  renameColumn as opRenameColumn,
  trimWhitespace as opTrimWhitespace,
} from "@/cleaning/operations";

const MAX_HISTORY = 20;

export type LoadStatus = "empty" | "loading" | "ready" | "error";

interface DatasetStore {
  status: LoadStatus;
  dataset: Dataset | null;
  history: HistoryEntry[];
  lastResult: OperationResult | null;
  lastResultId: string | null;
  errorMessage: string | null;
  operationError: string | null;

  loadFile: (file: File) => Promise<void>;
  resetDataset: () => void;
  dismissError: () => void;
  dismissOperationError: () => void;

  removeDuplicates: () => void;
  handleMissingValues: (
    columnName: string,
    strategy: MissingValueStrategy,
    fillValue?: string
  ) => void;
  trimWhitespace: (columnName: string) => void;
  convertColumnType: (columnName: string, newType: ColumnType) => void;
  renameColumn: (oldName: string, newName: string) => void;
  deleteColumn: (columnName: string) => void;

  undo: () => void;
}

function pushHistory(
  history: HistoryEntry[],
  previousDataset: Dataset,
  result: OperationResult
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: nanoid(),
    label: result.label,
    detail: result.detail,
    timestamp: Date.now(),
    snapshot: previousDataset,
  };
  const next = [...history, entry];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const useDatasetStore = create<DatasetStore>((set, get) => ({
  status: "empty",
  dataset: null,
  history: [],
  lastResult: null,
  lastResultId: null,
  errorMessage: null,
  operationError: null,

  loadFile: async (file: File) => {
    set({ status: "loading", errorMessage: null });
    try {
      const dataset = await parseFile(file);
      set({
        status: "ready",
        dataset,
        history: [],
        lastResult: null,
        lastResultId: null,
        errorMessage: null,
        operationError: null,
      });
    } catch (error) {
      const message =
        error instanceof FileParseError
          ? error.message
          : "Impossible de lire ce fichier. Vérifiez son format et réessayez.";
      set({ status: "error", errorMessage: message });
    }
  },

  resetDataset: () => {
    set({
      status: "empty",
      dataset: null,
      history: [],
      lastResult: null,
      lastResultId: null,
      errorMessage: null,
      operationError: null,
    });
    // A new dataset means any chart/KPI configured against the previous
    // file's columns is no longer meaningful — start the dashboard fresh too.
    useDashboardStore.getState().resetDashboard();
    useReportStore.getState().resetReport();
    // Same reasoning for text-to-SQL: past questions/history reference a
    // dataset that no longer exists, and the DuckDB `data` table itself
    // gets reloaded from scratch once a new file lands.
    useTextToSqlStore.getState().resetQuery();
    // A new dataset invalidates any AI-generated observations too — they'd
    // describe stats that no longer match the loaded data.
    useInsightsStore.getState().reset();
  },

  dismissError: () => set({ status: "empty", errorMessage: null }),
  dismissOperationError: () => set({ operationError: null }),

  removeDuplicates: () => {
    const { dataset, history } = get();
    if (!dataset) return;
    const { dataset: next, result } = opRemoveDuplicateRows(dataset);
    set({
      dataset: next,
      history: pushHistory(history, dataset, result),
      lastResult: result,
      lastResultId: nanoid(),
    });
  },

  handleMissingValues: (columnName, strategy, fillValue) => {
    const { dataset, history } = get();
    if (!dataset) return;
    const { dataset: next, result } = opHandleMissingValues(
      dataset,
      columnName,
      strategy,
      fillValue
    );
    set({
      dataset: next,
      history: pushHistory(history, dataset, result),
      lastResult: result,
      lastResultId: nanoid(),
    });
  },

  trimWhitespace: (columnName) => {
    const { dataset, history } = get();
    if (!dataset) return;
    const { dataset: next, result } = opTrimWhitespace(dataset, columnName);
    set({
      dataset: next,
      history: pushHistory(history, dataset, result),
      lastResult: result,
      lastResultId: nanoid(),
    });
  },

  convertColumnType: (columnName, newType) => {
    const { dataset, history } = get();
    if (!dataset) return;
    try {
      const { dataset: next, result } = opConvertColumnType(
        dataset,
        columnName,
        newType
      );
      set({
        dataset: next,
        history: pushHistory(history, dataset, result),
        lastResult: result,
        lastResultId: nanoid(),
      });
    } catch (error) {
      set({
        operationError:
          error instanceof Error ? error.message : "Conversion impossible.",
      });
    }
  },

  renameColumn: (oldName, newName) => {
    const { dataset, history } = get();
    if (!dataset) return;
    try {
      const { dataset: next, result } = opRenameColumn(dataset, oldName, newName);
      if (next === dataset) {
        set({ lastResult: result, lastResultId: nanoid() });
        return;
      }
      set({
        dataset: next,
        history: pushHistory(history, dataset, result),
        lastResult: result,
        lastResultId: nanoid(),
      });
    } catch (error) {
      set({
        operationError:
          error instanceof Error ? error.message : "Renommage impossible.",
      });
    }
  },

  deleteColumn: (columnName) => {
    const { dataset, history } = get();
    if (!dataset) return;
    const { dataset: withoutColumn, result } = opDeleteColumn(dataset, columnName);
    const next = redetectTypes(withoutColumn);
    set({
      dataset: next,
      history: pushHistory(history, dataset, result),
      lastResult: result,
      lastResultId: nanoid(),
    });
  },

  undo: () => {
    const { history } = get();
    if (history.length === 0) return;
    const last = history[history.length - 1];
    set({
      dataset: last.snapshot,
      history: history.slice(0, -1),
      lastResult: {
        label: "Action annulée",
        detail: `« ${last.label} » a été annulée.`,
        affectedCount: 0,
      },
      lastResultId: nanoid(),
    });
  },
}));
