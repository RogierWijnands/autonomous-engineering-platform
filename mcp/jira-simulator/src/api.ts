import type { Issue, Project } from "./types";

export interface Snapshot {
  projects: Project[];
  issues: Issue[];
}

export async function request<T extends Snapshot>(
  path: string,
  data?: object,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api/${path}`, {
      ...(data
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        : {}),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(
      data
        ? "Could not reach the API. Changes may have been saved; refresh before retrying."
        : "Could not reach the API. Check that the simulator API is running.",
    );
  }

  if (!response.ok) {
    if (response.headers.get("content-type")?.includes("application/json")) {
      const body: { error?: string } = await response.json();

      throw new Error(body.error || `Request failed (${response.status}).`);
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}
