import { create } from "zustand";
import type { Dataset } from "@/types/dataset";
import { parseFile, FileParseError } from "@/lib/fileParser";
import { loadDatasetIntoDuckDB, QUERY_TABLE_NAME } from "@/lib/duckdb/loadDataset";
import { sanitizeTableName } from "@/lib/duckdb/tableName";

type SecondaryTableStatus = "idle" | "loading" | "ready" | "error";

interface SecondaryTableStore {
  status: SecondaryTableStatus;
  dataset: Dataset | null;
  tableName: string | null;
  errorMessage: string | null;

  load: (file: File) => Promise<void>;
  clear: () => void;
}

/**
 * A second, independent dataset joined specifically on the "Interroger" page
 * so text-to-SQL and the agent can write JOINs — deliberately NOT wired into
 * `useDatasetStore.resetDataset()`'s cross-store reset cascade: uploading a
 * new primary file keeps this table loaded (the user removes it manually).
 */
export const useSecondaryTableStore = create<SecondaryTableStore>((set) => ({
  status: "idle",
  dataset: null,
  tableName: null,
  errorMessage: null,

  load: async (file) => {
    set({ status: "loading", errorMessage: null });
    try {
      const dataset = await parseFile(file);
      const tableName = sanitizeTableName(dataset.fileName, QUERY_TABLE_NAME);
      await loadDatasetIntoDuckDB(dataset, tableName);
      set({ status: "ready", dataset, tableName });
    } catch (error) {
      const message =
        error instanceof FileParseError || error instanceof Error
          ? error.message
          : "Impossible de charger ce fichier.";
      set({ status: "error", errorMessage: message, dataset: null, tableName: null });
    }
  },

  clear: () => set({ status: "idle", dataset: null, tableName: null, errorMessage: null }),
}));
