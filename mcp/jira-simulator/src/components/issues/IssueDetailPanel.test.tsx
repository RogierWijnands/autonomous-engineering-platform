import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../types";
import { IssueDetailPanel } from "./IssueDetailPanel";

const story: Issue = {
  key: "ALPHA-1001",
  projectId: "project-alpha",
  summary: "Implement validation",
  description: "Validate incoming requests.",
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
  summary: "Add request validation",
  issueType: "Task",
};

function renderPanel(
  issue: Issue,
  parentIssue?: Issue,
  subtasks: Issue[] = [],
  onOpenIssue = vi.fn(),
) {
  return render(
    <IssueDetailPanel
      issue={issue}
      parentIssue={parentIssue}
      subtasks={subtasks}
      projectName="Alpha Project"
      canMakeSubtask={!issue.parentIssueKey}
      onClose={vi.fn()}
      onUpdate={vi.fn()}
      onEdit={vi.fn()}
      onMakeSubtask={vi.fn()}
      onMakeStandalone={vi.fn()}
      onCreateSubtask={vi.fn()}
      onOpenIssue={onOpenIssue}
    />,
  );
}

describe("IssueDetailPanel subtasks", () => {
  it("offers subtasks only on Stories and opens a listed subtask", () => {
    const onCreateSubtask = vi.fn();
    const onOpenIssue = vi.fn();
    render(
      <IssueDetailPanel
        issue={story}
        subtasks={[subtask]}
        projectName="Alpha Project"
        canMakeSubtask
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        onMakeSubtask={vi.fn()}
        onMakeStandalone={vi.fn()}
        onCreateSubtask={onCreateSubtask}
        onOpenIssue={onOpenIssue}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Add subtask to ALPHA-1001" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open subtask ALPHA-1002: Add request validation (To Do)",
      }),
    );

    expect(onCreateSubtask).toHaveBeenCalledWith(story);
    expect(onOpenIssue).toHaveBeenCalledWith(subtask);
    expect(screen.getByRole("region", { name: "Subtasks" })).toHaveTextContent(
      "Add request validation",
    );
  });

  it("shows a parent Story for a Task without allowing nested subtasks", () => {
    const onOpenIssue = vi.fn();
    renderPanel(subtask, story, [], onOpenIssue);

    expect(
      screen.queryByRole("button", { name: /Add subtask/ }),
    ).not.toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Issue breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Alpha Project / ALPHA-1001 / ALPHA-1002");
    expect(within(breadcrumb).getByText("ALPHA-1002")).toHaveAttribute("aria-current", "page");
    const parentButton = screen.getByRole("button", { name: "Open parent issue ALPHA-1001: Implement validation" });
    expect(parentButton).toHaveTextContent("ALPHA-1001: Implement validation");
    expect(screen.getByText("Subtask of")).toBeInTheDocument();
    fireEvent.click(parentButton);
    expect(onOpenIssue).toHaveBeenCalledWith(story);
    fireEvent.click(within(breadcrumb).getByRole("button", { name: /ALPHA-1001/ }));

    expect(onOpenIssue).toHaveBeenCalledWith(story);
    expect(
      screen.queryByRole("button", { name: /Add subtask/ }),
    ).not.toBeInTheDocument();
  });

  it("reports the parent key when the referenced parent cannot be found", () => {
    renderPanel(subtask);
    expect(screen.getByText("ALPHA-1001 (parent issue not found)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open parent issue/ })).not.toBeInTheDocument();
  });

  it("offers a standalone action only for subtasks", () => {
    const onMakeStandalone = vi.fn();
    const { rerender } = render(
      <IssueDetailPanel
        issue={subtask}
        parentIssue={story}
        subtasks={[]}
        projectName="Alpha Project"
        canMakeSubtask={false}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        onMakeSubtask={vi.fn()}
        onMakeStandalone={onMakeStandalone}
        onCreateSubtask={vi.fn()}
        onOpenIssue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Make standalone task" }));
    expect(onMakeStandalone).toHaveBeenCalledWith(subtask);
    rerender(
      <IssueDetailPanel
        issue={story}
        subtasks={[]}
        projectName="Alpha Project"
        canMakeSubtask
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        onMakeSubtask={vi.fn()}
        onMakeStandalone={onMakeStandalone}
        onCreateSubtask={vi.fn()}
        onOpenIssue={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Make standalone task" })).not.toBeInTheDocument();
    expect(screen.queryByText("Subtask of")).not.toBeInTheDocument();
  });

  it("offers a move action for a subtask when a different parent is available", () => {
    const onMakeSubtask = vi.fn();
    render(
      <IssueDetailPanel
        issue={subtask}
        parentIssue={story}
        subtasks={[]}
        projectName="Alpha Project"
        canMakeSubtask
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        onMakeSubtask={onMakeSubtask}
        onMakeStandalone={vi.fn()}
        onCreateSubtask={vi.fn()}
        onOpenIssue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move subtask" }));
    expect(onMakeSubtask).toHaveBeenCalledWith(subtask);
    expect(screen.getByRole("button", { name: "Make standalone task" })).toBeInTheDocument();
  });
});
