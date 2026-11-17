import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IssueStatus, Issue } from "../../types";
import { ProjectSummary } from "./ProjectSummary";

function makeIssue(index: number, status: IssueStatus): Issue {
  return {
    key: `ALPHA-${index}`,
    projectId: "project-alpha",
    summary: `Issue ${index}`,
    description: "",
    issueType: "Task",
    priority: "Medium",
    status,
    labels: [],
    acceptanceCriteria: [],
  };
}

describe("ProjectSummary", () => {
  it("calculates project totals and completion progress", () => {
    render(
      <ProjectSummary
        issues={[
          makeIssue(1, "To Do"),
          makeIssue(2, "In Progress"),
          makeIssue(3, "Done"),
          makeIssue(4, "Done"),
        ]}
      />,
    );
    const summary = screen.getByRole("region", { name: "Project overview" });

    expect(within(summary).getByText("4")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(within(summary).getByText("50%")).toBeInTheDocument();
    expect(
      within(summary).getByRole("progressbar", {
        name: "Project progress",
        value: { now: 50, min: 0, max: 100 },
      }),
    ).toBeInTheDocument();
  });

  it("shows zero progress for a project with no issues", () => {
    render(<ProjectSummary issues={[]} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
