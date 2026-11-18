export type IssueType = "Story" | "Task" | "Bug";
export type Priority = "Highest" | "High" | "Medium" | "Low";
export const issueStatuses = ["To Do", "In Progress", "Done"] as const;
export type IssueStatus = (typeof issueStatuses)[number];
export type IssueView = "board" | "list";

export interface Project {
  id: string;
  name: string;
  repository?: string;
}

export type ProjectDraft = Pick<Project, "name" | "repository">;

export interface Issue {
  key: string;
  projectId: string;
  parentIssueKey?: string;
  summary: string;
  description: string;
  issueType: IssueType;
  priority: Priority;
  status: IssueStatus;
  labels: string[];
  acceptanceCriteria: string[];
  repository?: string;
  evidence?: EvidenceDocument;
}

export type IssueDraft = Omit<
  Issue,
  "key" | "projectId" | "status" | "parentIssueKey" | "evidence"
>;
import type { EvidenceDocument } from "./utils/evidence";
