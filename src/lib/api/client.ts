const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

/** status 0 means the request never reached the server (network/connectivity failure). */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") {
      return data.detail;
    }
  } catch {
    // Body wasn't JSON (or was empty) — fall through to the generic message below.
  }
  return `Erreur serveur (${response.status}).`;
}

/** Shared POST-JSON helper for every backend endpoint (text-to-SQL, insights, ...). */
export async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      `Impossible de contacter le serveur backend (${API_BASE_URL}). Vérifiez qu'il est démarré.`
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  return (await response.json()) as TResponse;
}