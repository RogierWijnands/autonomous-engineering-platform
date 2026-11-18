import type { IssueDraft, IssueStatus } from "../types.ts";

type IssueFields = IssueDraft & { status: IssueStatus };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isIssueStatus(value: unknown): value is IssueStatus {
  return value === "To Do" || value === "In Progress" || value === "Done";
}

export function isIssueFields(
  value: unknown,
): value is IssueFields & Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    typeof value.description === "string" &&
    (value.issueType === "Story" ||
      value.issueType === "Task" ||
      value.issueType === "Bug") &&
    (value.priority === "Highest" ||
      value.priority === "High" ||
      value.priority === "Medium" ||
      value.priority === "Low") &&
    isIssueStatus(value.status) &&
    Array.isArray(value.labels) &&
    Array.isArray(value.acceptanceCriteria) &&
    [...value.labels, ...value.acceptanceCriteria].every(
      (item: unknown) => typeof item === "string",
    )
  );
}
