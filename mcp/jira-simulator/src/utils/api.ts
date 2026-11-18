import type { Issue, Project } from "../types";
import { isIssueFields, isRecord } from "./issueValidation";

export interface Snapshot {
  projects: Project[];
  issues: Issue[];
}

function isProject(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isIssue(value: unknown): boolean {
  return (
    isIssueFields(value) &&
    typeof value.key === "string" &&
    typeof value.projectId === "string" &&
    (value.parentIssueKey === undefined ||
      typeof value.parentIssueKey === "string")
  );
}

// Evidence has its own validation at the rendering and editor boundary.
export function validateSnapshot(
  value: unknown,
  isWrite = false,
  requiredResult?: "issue" | "project",
): void {
  if (
    !isRecord(value) ||
    !Array.isArray(value.projects) ||
    !value.projects.every(isProject) ||
    !Array.isArray(value.issues) ||
    !value.issues.every(isIssue) ||
    (value.project !== undefined && !isProject(value.project)) ||
    (value.issue !== undefined && !isIssue(value.issue)) ||
    (requiredResult === "project" && !isProject(value.project)) ||
    (requiredResult === "issue" && !isIssue(value.issue))
  ) {
    throw new Error(
      isWrite
        ? "Invalid simulator data. Changes may have been saved; refresh and check before retrying."
        : "Invalid simulator data. Refresh and check the simulator API.",
    );
  }
}

export async function request<T>(
  path: string,
  data?: object,
  networkError?: string,
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
      networkError ??
        (data
          ? "Could not reach the API. Changes may have been saved; refresh before retrying."
          : "Could not reach the API. Check that the simulator API is running."),
    );
  }

  if (!response.ok) {
    if (response.headers.get("content-type")?.includes("application/json")) {
      const body: { error?: string } = await response.json();

      if (response.status === 404 && body.error === "Not found.") {
        throw new Error(
          "API endpoint not found. Check that the simulator API is current and restart it if necessary.",
        );
      }
      throw new Error(body.error || `Request failed (${response.status}).`);
    }

    throw new Error(`Request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}
