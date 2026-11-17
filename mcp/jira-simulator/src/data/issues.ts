import type { Issue } from "../types";

export const initialIssues: Issue[] = [
  {
    key: "DEMO-1001",
    projectId: "project-demo",
    summary: "Add health check endpoint",
    description:
      "Add an endpoint that reports application and dependency health for local development.",
    issueType: "Story",
    priority: "Medium",
    status: "In Progress",
    labels: ["backend", "demo"],
    acceptanceCriteria: [
      "The endpoint returns a healthy response when required dependencies are available",
      "The endpoint returns an unavailable response when a required dependency is down",
      "The response does not expose connection details or credentials",
      "Unit tests cover healthy and unavailable states",
    ],
  },
  {
    key: "DEMO-1002",
    projectId: "project-demo",
    summary: "Validate incoming request payloads",
    description:
      "Validate required fields and reject malformed request data before processing.",
    issueType: "Story",
    priority: "High",
    status: "To Do",
    labels: ["backend", "security"],
    acceptanceCriteria: [
      "Required fields are checked before processing",
      "Malformed values receive a clear validation response",
      "Sensitive values are excluded from application logs",
    ],
  },
  {
    key: "DEMO-1003",
    projectId: "project-demo",
    summary: "Document local development setup",
    description:
      "Make it easy for a new contributor to start the application and its supporting services.",
    issueType: "Task",
    priority: "Low",
    status: "Done",
    labels: ["documentation"],
    acceptanceCriteria: [
      "Setup instructions list the required tools",
      "Database startup and migration steps are documented",
    ],
  },
  {
    key: "DEMO-1004",
    projectId: "project-demo",
    summary: "Return clear errors for invalid identifiers",
    description:
      "Reject invalid resource identifiers with a consistent error response.",
    issueType: "Bug",
    priority: "Highest",
    status: "To Do",
    labels: ["backend", "validation"],
    acceptanceCriteria: [
      "Malformed identifiers are rejected",
      "Unknown identifiers return a not-found response",
      "The response identifies the invalid field",
    ],
  },
  {
    key: "DEMO-1005",
    projectId: "project-demo",
    summary: "Add policy decision audit events",
    description:
      "Record an audit event whenever a workflow policy allows or blocks an action.",
    issueType: "Story",
    priority: "High",
    status: "In Progress",
    labels: ["audit", "backend"],
    acceptanceCriteria: [
      "Policy decisions include a workflow reference",
      "Audit events include the decision and timestamp",
      "Audit events cannot be silently overwritten",
    ],
  },
  {
    key: "DEMO-1006",
    projectId: "project-demo",
    summary: "Fix empty workflow state on restart",
    description:
      "Restore persisted workflow state after restarting the local orchestrator.",
    issueType: "Bug",
    priority: "Medium",
    status: "Done",
    labels: ["workflow", "persistence"],
    acceptanceCriteria: [
      "Existing workflows load after a process restart",
      "A workflow is not duplicated during recovery",
    ],
  },
  {
    key: "DEMO-1007",
    projectId: "project-demo",
    summary: "Prepare agent workspace isolation",
    description:
      "Define the minimum network and filesystem boundaries for a local agent workspace.",
    issueType: "Task",
    priority: "Medium",
    status: "To Do",
    labels: ["security", "infrastructure"],
    acceptanceCriteria: [
      "Workspace access is limited to the checked-out project",
      "Agent containers receive no host credentials",
    ],
  },
  {
    key: "DEMO-1008",
    projectId: "project-demo",
    parentIssueKey: "DEMO-1001",
    summary: "Implement dependency health checks",
    description:
      "Check the availability of required dependencies for the health endpoint.",
    issueType: "Task",
    priority: "Medium",
    status: "To Do",
    labels: ["backend", "demo"],
    acceptanceCriteria: [
      "Required dependencies are checked without exposing connection details",
    ],
  },
  {
    key: "DEMO-1009",
    projectId: "project-demo",
    parentIssueKey: "DEMO-1001",
    summary: "Define health response format",
    description:
      "Define a response format for healthy and unavailable application states.",
    issueType: "Task",
    priority: "Medium",
    status: "Done",
    labels: ["backend", "demo"],
    acceptanceCriteria: [
      "The response identifies the overall health status",
    ],
  },
];
