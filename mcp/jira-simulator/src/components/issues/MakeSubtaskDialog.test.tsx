import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../types";
import { MakeSubtaskDialog } from "./MakeSubtaskDialog";

const source: Issue = {
  key: "ALPHA-1001",
  projectId: "alpha",
  summary: "Source story",
  description: "",
  issueType: "Story",
  priority: "Medium",
  status: "In Progress",
  labels: [],
  acceptanceCriteria: [],
};
const task: Issue = { ...source, key: "ALPHA-1002", issueType: "Task", summary: "Target task" };
const story: Issue = { ...source, key: "ALPHA-1003", summary: "Target story" };

describe("MakeSubtaskDialog", () => {
  it("explains conversions and confirms the selected parent", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <MakeSubtaskDialog
        issue={source}
        candidates={[task, story]}
        initialParentKey={task.key}
        hasSubtasks
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(within(dialog).getByRole("status")).toHaveTextContent("ALPHA-1002 will become a Story");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Existing subtasks of ALPHA-1001 will become standalone Tasks");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Parent issue" }), story.key);
    expect(within(dialog).getByRole("status")).not.toHaveTextContent("will become a Story");
    await user.click(within(dialog).getByRole("button", { name: "Make subtask" }));
    expect(onConfirm).toHaveBeenCalledWith(story.key);
  });

  it("requires a parent and allows cancellation without confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<MakeSubtaskDialog issue={source} candidates={[task]} hasSubtasks={false} onConfirm={onConfirm} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    const parent = within(dialog).getByRole("combobox", { name: "Parent issue" });
    expect(parent).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Make subtask" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(parent).toBeInvalid();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("explains the previous parent when moving an existing subtask", () => {
    const subtask: Issue = { ...source, issueType: "Task", parentIssueKey: story.key };
    render(
      <MakeSubtaskDialog
        issue={subtask}
        candidates={[task]}
        initialParentKey={task.key}
        hasSubtasks={false}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    expect(dialog).toHaveAccessibleDescription(/ALPHA-1001 will be moved from ALPHA-1003/);
    expect(within(dialog).getByRole("status")).toHaveTextContent("ALPHA-1002 will become a Story");
    expect(within(dialog).getByRole("combobox", { name: "Parent issue" })).toHaveValue(task.key);
  });
});
