import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../types";
import { IssueCard } from "./IssueCard";

const story: Issue = {
  key: "ALPHA-1001",
  projectId: "alpha",
  summary: "Build the endpoint",
  description: "",
  issueType: "Story",
  priority: "Medium",
  status: "In Progress",
  labels: [],
  acceptanceCriteria: [],
};
const subtask: Issue = {
  ...story,
  key: "ALPHA-1002",
  parentIssueKey: story.key,
  issueType: "Task",
  summary: "Validate the input",
  status: "Done",
};
const dragProps = {
  isDropTarget: false,
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDrop: vi.fn(),
  onDragEnd: vi.fn(),
};

describe("IssueCard subtasks", () => {
  it("expands and collapses with the keyboard and opens a subtask independently", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <IssueCard
        issue={story}
        subtasks={[subtask]}
        instructionsId="instructions"
        subtaskInstructionsId="subtask-instructions"
        {...dragProps}
        onOpen={onOpen}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Subtasks for ALPHA-1001" });
    const name = "Open subtask ALPHA-1002: Validate the input (Done)";
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const list = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(list).toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();

    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(list).not.toHaveAttribute("hidden");
    await user.click(screen.getByRole("button", { name }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(subtask);
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Build the endpoint/ }));
    expect(onOpen).toHaveBeenLastCalledWith(story);
  });

  it("does not offer a toggle for empty Stories or Tasks", () => {
    const { rerender } = render(
      <IssueCard issue={story} subtasks={[]} instructionsId="instructions" subtaskInstructionsId="subtask-instructions" onOpen={vi.fn()} {...dragProps} />,
    );
    expect(screen.queryByRole("button", { name: /Subtasks for/ })).not.toBeInTheDocument();
    rerender(
      <IssueCard issue={subtask} subtasks={[subtask]} instructionsId="instructions" subtaskInstructionsId="subtask-instructions" onOpen={vi.fn()} {...dragProps} />,
    );
    expect(screen.queryByRole("button", { name: /Subtasks for/ })).not.toBeInTheDocument();
  });

  it("starts a drag with the subtask identity and provides its own instructions", async () => {
    const user = userEvent.setup();
    const onDragStart = vi.fn();
    const setData = vi.fn();
    const dataTransfer = { effectAllowed: "", setData };
    render(
      <IssueCard
        issue={story}
        subtasks={[subtask]}
        instructionsId="instructions"
        subtaskInstructionsId="subtask-instructions"
        onOpen={vi.fn()}
        {...dragProps}
        onDragStart={onDragStart}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Subtasks for ALPHA-1001" }));
    const subtaskButton = screen.getByRole("button", { name: /Open subtask ALPHA-1002/ });
    expect(subtaskButton).toHaveAttribute("draggable", "true");
    expect(subtaskButton).toHaveAttribute("aria-describedby", "subtask-instructions");
    fireEvent.dragStart(subtaskButton, { dataTransfer });
    expect(setData).toHaveBeenCalledWith("text/plain", subtask.key);
    expect(onDragStart).toHaveBeenCalledWith(subtask);
  });
});
