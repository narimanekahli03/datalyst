import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Dataset } from "@/types/dataset";
import type { DuckDbStatus, QueryPhase, QueryResult, TextToSqlHistoryEntry } from "@/types/textToSql";
import { ExecutionFailedError, loadDatasetIntoDuckDB, runQuery } from "@/lib/duckdb/loadDataset";
import { ApiError, fixSql, generateSql, summarize } from "@/lib/textToSql/api";
import { buildDatasetSchema } from "@/lib/textToSql/schemaBuilder";

/** Auto-correction loop cap: 1 initial execution + up to 2 fix attempts. */
const MAX_FIX_ATTEMPTS = 2;
/** Row cap for the /summarize payload — keeps the request small regardless of result size. */
const SUMMARIZE_ROW_CAP = 40;

interface TextToSqlStore {
  duckDbStatus: DuckDbStatus;
  duckDbError: string | null;

  question: string;
  phase: QueryPhase;
  currentSql: string | null;
  currentExplanation: string | null;
  currentResult: QueryResult | null;
  currentSummary: string | null;
  errorMessage: string | null;
  history: TextToSqlHistoryEntry[];

  initDuckDb: (dataset: Dataset) => Promise<void>;
  ask: (question: string, dataset: Dataset) => Promise<void>;
  replay: (entryId: string) => void;
  resetQuery: () => void;
}

function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Trop de requêtes vers l'IA (limite du plan gratuit Mistral : 2 par minute). Réessayez dans quelques secondes.";
    }
    return error.message || "Une erreur est survenue lors de la communication avec le serveur IA.";
  }
  if (error instanceof ExecutionFailedError) {
    return `La requête SQL générée n'a pas pu être exécutée, même après correction automatique (${error.message}). Essayez de reformuler votre question.`;
  }
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

export const useTextToSqlStore = create<TextToSqlStore>((set, get) => ({
  duckDbStatus: "idle",
  duckDbError: null,

  question: "",
  phase: "idle",
  currentSql: null,
  currentExplanation: null,
  currentResult: null,
  currentSummary: null,
  errorMessage: null,
  history: [],

  initDuckDb: async (dataset) => {
    // Guards against overlapping inits from React StrictMode's double-invoked effects.
    if (get().duckDbStatus === "initializing") return;
    set({ duckDbStatus: "initializing", duckDbError: null });
    try {
      await loadDatasetIntoDuckDB(dataset);
      set({ duckDbStatus: "ready" });
    } catch (error) {
      set({
        duckDbStatus: "error",
        duckDbError:
          error instanceof Error ? error.message : "Impossible d'initialiser le moteur SQL local.",
      });
    }
  },

  ask: async (question, dataset) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    set({
      question: trimmed,
      phase: "generating",
      currentSql: null,
      currentExplanation: null,
      currentResult: null,
      currentSummary: null,
      errorMessage: null,
    });

    try {
      const schema = buildDatasetSchema(dataset);

      const generated = await generateSql({ question: trimmed, schema });
      let sql = generated.sql;
      let explanation = generated.explanation;
      set({ currentSql: sql, currentExplanation: explanation, phase: "executing" });

      let result: QueryResult | null = null;
      let lastErrorMessage = "";
      for (let attempt = 0; attempt <= MAX_FIX_ATTEMPTS; attempt += 1) {
        try {
          result = await runQuery(sql);
          break;
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : String(error);
          if (attempt === MAX_FIX_ATTEMPTS) {
            throw new ExecutionFailedError(lastErrorMessage);
          }
          set({ phase: "fixing" });
          const fixed = await fixSql({
            question: trimmed,
            sql,
            error_message: lastErrorMessage,
            schema,
          });
          sql = fixed.sql;
          explanation = fixed.explanation;
          set({ currentSql: sql, currentExplanation: explanation, phase: "executing" });
        }
      }
      if (!result) throw new ExecutionFailedError(lastErrorMessage);

      set({ currentResult: result, phase: "summarizing" });

      const summaryResponse = await summarize({
        question: trimmed,
        sql,
        columns: result.columns,
        rows: result.rows.slice(0, SUMMARIZE_ROW_CAP),
        row_count: result.rows.length,
        truncated: result.rows.length > SUMMARIZE_ROW_CAP,
      });

      const entry: TextToSqlHistoryEntry = {
        id: nanoid(),
        question: trimmed,
        sql,
        explanation,
        result,
        summary: summaryResponse.summary,
        timestamp: Date.now(),
      };

      set((state) => ({
        currentSummary: summaryResponse.summary,
        phase: "done",
        history: [entry, ...state.history],
      }));
    } catch (error) {
      set({ phase: "error", errorMessage: friendlyMessage(error) });
    }
  },

  replay: (entryId) => {
    const entry = get().history.find((h) => h.id === entryId);
    if (!entry) return;
    // Restores the cached run instantly — no DuckDB re-execution, no backend
    // calls, so revisiting history never costs against the Mistral rate limit.
    set({
      question: entry.question,
      currentSql: entry.sql,
      currentExplanation: entry.explanation,
      currentResult: entry.result,
      currentSummary: entry.summary,
      phase: "done",
      errorMessage: null,
    });
  },

  resetQuery: () =>
    set({
      question: "",
      phase: "idle",
      currentSql: null,
      currentExplanation: null,
      currentResult: null,
      currentSummary: null,
      errorMessage: null,
      history: [],
    }),
}));
