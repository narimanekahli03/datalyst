import { create } from "zustand";
import type { Dataset } from "@/types/dataset";
import type { Insight } from "@/types/insights";
import { computeExploration } from "@/lib/exploreStats";
import { buildInsightsPayload } from "@/lib/insights/buildInsightsPayload";
import { generateInsights as callGenerateInsights } from "@/lib/insights/api";
import { ApiError } from "@/lib/api/client";

export type InsightsStatus = "idle" | "loading" | "ready" | "error";

interface InsightsStore {
  status: InsightsStatus;
  insights: Insight[];
  errorMessage: string | null;

  generateInsights: (dataset: Dataset) => Promise<void>;
  reset: () => void;
}

function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Trop de requêtes vers l'IA (limite du plan gratuit Mistral : 2 par minute). Réessayez dans quelques secondes.";
    }
    return error.message || "Une erreur est survenue lors de la génération des observations.";
  }
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

export const useInsightsStore = create<InsightsStore>((set, get) => ({
  status: "idle",
  insights: [],
  errorMessage: null,

  generateInsights: async (dataset) => {
    // Guards against double-submission (e.g. a fast double-click on
    // "Régénérer"), not against repeat calls in general — the caller
    // decides when regeneration is warranted.
    if (get().status === "loading") return;
    set({ status: "loading", errorMessage: null });
    try {
      const exploration = computeExploration(dataset);
      const payload = buildInsightsPayload(exploration);
      const response = await callGenerateInsights(payload);
      set({ status: "ready", insights: response.insights });
    } catch (error) {
      set({ status: "error", errorMessage: friendlyMessage(error) });
    }
  },

  reset: () => set({ status: "idle", insights: [], errorMessage: null }),
}));