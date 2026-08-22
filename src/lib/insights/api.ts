import type { InsightsRequestPayload, InsightsResponse } from "@/types/insights";
import { postJson } from "@/lib/api/client";

export function generateInsights(payload: InsightsRequestPayload): Promise<InsightsResponse> {
  return postJson<InsightsResponse>("/generate-insights", payload);
}