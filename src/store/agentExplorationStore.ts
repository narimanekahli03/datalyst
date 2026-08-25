import { create } from "zustand";
import type { Dataset } from "@/types/dataset";
import type { Insight } from "@/types/insights";
import type { AgentPhase, AgentStepRecord, AgentTrailEntry } from "@/types/agent";
import { runQuery } from "@/lib/duckdb/loadDataset";
import { ApiError, agentStep } from "@/lib/agent/api";
import { buildDatasetSchema } from "@/lib/textToSql/schemaBuilder";
import { useDashboardStore } from "@/store/dashboardStore";

/** Loop cap: each step is one Mistral call, and the free tier allows only
 * 2 requests/minute — 3 keeps the worst case (3 sequential calls) under a
 * minute while still leaving at least 2 real exploratory actions before the
 * forced conclusion on the last step. */
const MAX_AGENT_STEPS = 3;
/** Sample rows sent back per step so the growing history stays small across steps. */
const SAMPLE_ROW_CAP = 5;

interface AgentExplorationStore {
  phase: AgentPhase;
  trail: AgentTrailEntry[];
  summary: string | null;
  findings: Insight[];
  errorMessage: string | null;

  run: (dataset: Dataset) => Promise<void>;
  reset: () => void;
}

function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Trop de requêtes vers l'IA (limite du plan gratuit Mistral : 2 par minute). Réessayez dans quelques secondes.";
    }
    return error.message || "Une erreur est survenue lors de la communication avec l'agent IA.";
  }
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

const INITIAL_STATE = {
  phase: "idle" as AgentPhase,
  trail: [] as AgentTrailEntry[],
  summary: null as string | null,
  findings: [] as Insight[],
  errorMessage: null as string | null,
};

export const useAgentExplorationStore = create<AgentExplorationStore>((set, get) => ({
  ...INITIAL_STATE,

  run: async (dataset) => {
    set({ ...INITIAL_STATE, phase: "thinking" });

    const schema = buildDatasetSchema(dataset);
    const history: AgentStepRecord[] = [];

    for (let stepNumber = 1; stepNumber <= MAX_AGENT_STEPS; stepNumber += 1) {
      set({ phase: "thinking" });
      const mustFinish = stepNumber === MAX_AGENT_STEPS;

      let response;
      try {
        response = await agentStep({
          schema,
          history,
          step_number: stepNumber,
          max_steps: MAX_AGENT_STEPS,
          must_finish: mustFinish,
        });
      } catch (error) {
        set({ phase: "error", errorMessage: friendlyMessage(error) });
        return;
      }

      if (response.action === "finish") {
        set({
          phase: "done",
          summary: response.summary ?? "",
          findings: response.findings ?? [],
        });
        return;
      }

      if (response.action === "chart") {
        const reasoning = response.reasoning ?? "";
        const title = response.chart_title ?? "Graphique";
        const type = response.chart_type ?? "bar";
        const xField = response.chart_x_field ?? "";
        const yFields = response.chart_y_fields ?? [];
        const aggregation = response.chart_aggregation ?? "sum";

        useDashboardStore.getState().addChart({
          title,
          type,
          xField,
          yFields,
          aggregation,
          groupByField: null,
        });

        history.push({
          action: "chart",
          reasoning,
          chart_title: title,
          chart_type: type,
          chart_x_field: xField,
          chart_y_fields: yFields,
          chart_aggregation: aggregation,
        });
        set((state) => ({
          trail: [
            ...state.trail,
            {
              stepNumber,
              action: "chart",
              reasoning,
              sql: null,
              result: null,
              chart: { title, type, xField, yFields, aggregation },
              errorMessage: null,
            },
          ],
        }));
        continue;
      }

      const sql = response.sql ?? "";
      const reasoning = response.reasoning ?? "";
      set({
        phase: "executing",
        trail: [
          ...get().trail,
          { stepNumber, action: "query", sql, reasoning, result: null, chart: null, errorMessage: null },
        ],
      });

      try {
        const result = await runQuery(sql);
        const sampleRows = result.rows.slice(0, SAMPLE_ROW_CAP);
        history.push({
          action: "query",
          sql,
          reasoning,
          row_count: result.rows.length,
          columns: result.columns,
          sample_rows: sampleRows,
          error_message: null,
        });
        set((state) => ({
          trail: state.trail.map((entry) =>
            entry.stepNumber === stepNumber
              ? { ...entry, result: { rowCount: result.rows.length, columns: result.columns } }
              : entry
          ),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        history.push({
          action: "query",
          sql,
          reasoning,
          row_count: 0,
          columns: [],
          sample_rows: [],
          error_message: message,
        });
        set((state) => ({
          trail: state.trail.map((entry) =>
            entry.stepNumber === stepNumber ? { ...entry, errorMessage: message } : entry
          ),
        }));
      }
    }

    // Defensive fallback — the last step always sends must_finish:true, so the
    // model should never reach here without concluding.
    set({ phase: "error", errorMessage: "L'agent n'a pas pu conclure son analyse." });
  },

  reset: () => set({ ...INITIAL_STATE }),
}));
