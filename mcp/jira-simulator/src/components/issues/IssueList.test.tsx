import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../types";
import { IssueList } from "./IssueList";

const story: Issue = {
  key: "ALPHA-1001",
  projectId: "alpha",
  summary: "Parent story",
  description: "",
  issueType: "Story",
  priority: "Medium",
  status: "To Do",
  labels: [],
  acceptanceCriteria: [],
};
const subtask: Issue = {
  ...story,
  key: "ALPHA-1002",
  parentIssueKey: story.key,
  summary: "Child task",
  issueType: "Task",
};

describe("IssueList parent column", () => {
  it("shows each subtask's parent and keeps issue actions usable", () => {
    const onOpenIssue = vi.fn();
    render(<IssueList issues={[story, subtask]} hasSubtasks onOpenIssue={onOpenIssue} />);
    expect(screen.getByRole("columnheader", { name: "Subtask of" })).toHaveAttribute("scope", "col");
    const parentRow = screen.getByRole("button", { name: /Open issue ALPHA-1001/ }).closest("tr");
    const childRow = screen.getByRole("button", { name: /Open issue ALPHA-1002/ }).closest("tr");
    expect(parentRow).not.toBeNull();
    expect(childRow).not.toBeNull();
    if (!parentRow || !childRow) throw new Error("Issue rows not found.");
    expect(within(parentRow).getAllByRole("cell")[1]).toHaveTextContent("—");
    expect(within(childRow).getByRole("cell", { name: "ALPHA-1001" })).toBeInTheDocument();
    fireEvent.click(within(childRow).getByRole("button", { name: /Open issue ALPHA-1002/ }));
    expect(onOpenIssue).toHaveBeenCalledWith(subtask);
  });

  it("omits the parent column when no subtasks exist and keeps empty-state spans correct", () => {
    const { rerender } = render(<IssueList issues={[]} hasSubtasks={false} onOpenIssue={vi.fn()} />);
    expect(screen.queryByRole("columnheader", { name: "Subtask of" })).not.toBeInTheDocument();
    expect(screen.getByText("No issues match your search.")).toHaveAttribute("colspan", "5");
    rerender(<IssueList issues={[]} hasSubtasks onOpenIssue={vi.fn()} />);
    expect(screen.getByRole("columnheader", { name: "Subtask of" })).toBeInTheDocument();
    expect(screen.getByText("No issues match your search.")).toHaveAttribute("colspan", "6");
  });
});
