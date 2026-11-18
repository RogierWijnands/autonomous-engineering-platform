import { z } from "zod";

export function createJiraClient(apiPort: number) {
  return async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    data?: object,
  ): Promise<T> {
    // Talk only to the local simulator; redirects must not change the target.
    let response: Response;
    try {
      response = await fetch(`http://127.0.0.1:${apiPort}/api/${path}`, {
        ...(data
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          : {}),
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
    } catch {
      // A timed-out write may already have committed, so avoid blind retries.
      throw new Error(
        data
          ? "Simulator API unavailable. The change may have been saved; read the issue before retrying."
          : "Simulator API unavailable. Check that the simulator API is running.",
      );
    }

    // Surface simulator errors and validate successful responses at the boundary.
    if (!response.ok) {
      const body: unknown = await response.json();
      const error = z.object({ error: z.string() }).safeParse(body);
      throw new Error(
        error.success
          ? error.data.error
          : `Simulator API returned HTTP ${response.status}.`,
      );
    }
    return schema.parse(await response.json());
  };
}

export type JiraClient = ReturnType<typeof createJiraClient>;
