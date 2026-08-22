import type {
  FixSqlRequest,
  FixSqlResponse,
  GenerateSqlRequest,
  GenerateSqlResponse,
  SummarizeRequest,
  SummarizeResponse,
} from "@/types/textToSql";
import { postJson } from "@/lib/api/client";

export { ApiError } from "@/lib/api/client";

export function generateSql(request: GenerateSqlRequest): Promise<GenerateSqlResponse> {
  return postJson<GenerateSqlResponse>("/generate-sql", request);
}

export function fixSql(request: FixSqlRequest): Promise<FixSqlResponse> {
  return postJson<FixSqlResponse>("/fix-sql", request);
}

export function summarize(request: SummarizeRequest): Promise<SummarizeResponse> {
  return postJson<SummarizeResponse>("/summarize", request);
}