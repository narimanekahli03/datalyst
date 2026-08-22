import type { AgentStepRequest, AgentStepResponse } from "@/types/agent";
import { postJson } from "@/lib/api/client";

export { ApiError } from "@/lib/api/client";

export function agentStep(request: AgentStepRequest): Promise<AgentStepResponse> {
  return postJson<AgentStepResponse>("/agent-step", request);
}
