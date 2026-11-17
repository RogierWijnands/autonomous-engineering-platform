import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../types";
import { IssueBoard } from "./IssueBoard";

const issue: Issue = {
  key: "ALPHA-1001",
  projectId: "project-alpha",
  summary: "Add request validation",
  description: "Validate incoming requests.",
  issueType: "Story",
  priority: "Medium",
  status: "To Do",
  labels: ["backend"],
  acceptanceCriteria: [],
};

function fireDragEvent(
  type: string,
  element: Element,
  dataTransfer: {
    effectAllowed: string;
    dropEffect: string;
    setData: (format: string, value: string) => void;
    getData: (format: string) => string;
  },
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  fireEvent(element, event);
}

describe("IssueBoard", () => {
  it("shows only the Story's project subtasks even when their cards are filtered out", async () => {
    const user = userEvent.setup();
    const subtask: Issue = {
      ...issue,
      key: "ALPHA-1002",
      summary: "Test response",
      issueType: "Task",
      parentIssueKey: issue.key,
      status: "Done",
    };
    const otherProject: Issue = {
      ...subtask,
      key: "OTHER-1002",
      projectId: "other",
      summary: "Other project",
    };
    const onOpenIssue = vi.fn();
    render(
      <IssueBoard
        issues={[issue]}
        projectIssues={[issue, subtask, otherProject]}
        onOpenIssue={onOpenIssue}
        onCreateIssue={vi.fn()}
        onMoveIssue={vi.fn()}
        onMakeSubtask={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Subtasks for ALPHA-1001" }));
    await user.click(screen.getByRole("button", {
      name: "Open subtask ALPHA-1002: Test response (Done)",
    }));
    expect(onOpenIssue).toHaveBeenCalledWith(subtask);
    expect(screen.queryByText("Other project")).not.toBeInTheDocument();
  });

  it("requests a status update when a issue is dropped into another column", () => {
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    const onMoveIssue = vi.fn();
    render(
      <IssueBoard
        issues={[issue]}
        projectIssues={[issue]}
        onOpenIssue={vi.fn()}
        onCreateIssue={vi.fn()}
        onMoveIssue={onMoveIssue}
        onMakeSubtask={vi.fn()}
      />,
    );

    fireDragEvent(
      "dragstart",
      screen.getByRole("button", { name: /ALPHA-1001/ }),
      dataTransfer,
    );
    const doneColumn = screen.getByRole("region", { name: "Done issues" });
    fireDragEvent("dragover", doneColumn, dataTransfer);
    fireDragEvent("drop", doneColumn, dataTransfer);

    expect(onMoveIssue).toHaveBeenCalledWith("ALPHA-1001", "Done");
    expect(
      within(doneColumn).getByText("No issues here yet"),
    ).toBeInTheDocument();
  });

  it("shows move areas in other columns during an internal drag and clears them after drop or cancellation", () => {
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    const onMoveIssue = vi.fn();
    const onMakeSubtask = vi.fn();
    render(
      <IssueBoard
        issues={[issue]}
        projectIssues={[issue]}
        onOpenIssue={vi.fn()}
        onCreateIssue={vi.fn()}
        onMoveIssue={onMoveIssue}
        onMakeSubtask={onMakeSubtask}
      />,
    );
    const source = screen.getByRole("button", { name: /ALPHA-1001/ });
    const toDo = screen.getByRole("region", { name: "To Do issues" });
    const done = screen.getByRole("region", { name: "Done issues" });
    expect(screen.queryByText(/Drop here to move/)).not.toBeInTheDocument();

    fireDragEvent("dragstart", source, dataTransfer);
    expect(within(toDo).queryByText(/Drop here to move/)).not.toBeInTheDocument();
    expect(screen.getByText("Drop here to move to In Progress")).toHaveAttribute("aria-hidden", "true");
    const dropArea = within(done).getByText("Drop here to move to Done");
    fireDragEvent("dragover", dropArea, dataTransfer);
    expect(done).toHaveClass("drag-over");
    fireDragEvent("drop", dropArea, dataTransfer);
    expect(onMoveIssue).toHaveBeenCalledWith(issue.key, "Done");
    expect(onMakeSubtask).not.toHaveBeenCalled();
    expect(screen.queryByText(/Drop here to move/)).not.toBeInTheDocument();

    fireDragEvent("dragstart", source, dataTransfer);
    expect(screen.getByText("Drop here to move to Done")).toBeInTheDocument();
    fireDragEvent("dragend", source, dataTransfer);
    expect(screen.queryByText(/Drop here to move/)).not.toBeInTheDocument();

    fireDragEvent("dragstart", source, dataTransfer);
    dataTransfer.setData("text/plain", "OTHER-1001");
    fireDragEvent("drop", screen.getByText("Drop here to move to Done"), dataTransfer);
    expect(onMoveIssue).toHaveBeenCalledTimes(1);
    expect(onMakeSubtask).not.toHaveBeenCalled();
    expect(screen.queryByText(/Drop here to move/)).not.toBeInTheDocument();
  });

  it("ignores a drop that does not contain an issue key", () => {
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: vi.fn(),
      getData: () => "",
    };
    const onMoveIssue = vi.fn();
    render(
      <IssueBoard
        issues={[issue]}
        projectIssues={[issue]}
        onOpenIssue={vi.fn()}
        onCreateIssue={vi.fn()}
        onMoveIssue={onMoveIssue}
        onMakeSubtask={vi.fn()}
      />,
    );

    fireDragEvent(
      "drop",
      screen.getByRole("region", { name: "Done issues" }),
      dataTransfer,
    );

    expect(onMoveIssue).not.toHaveBeenCalled();
  });

  it("allows a subtask to be dropped in any column or on a different issue", async () => {
    const user = userEvent.setup();
    const subtask: Issue = { ...issue, key: "ALPHA-1002", issueType: "Task", parentIssueKey: issue.key, status: "Done" };
    const target: Issue = { ...issue, key: "ALPHA-1003", issueType: "Task", status: "Done" };
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    const onMoveIssue = vi.fn();
    const onMakeSubtask = vi.fn();
    render(
      <IssueBoard
        issues={[issue, target]}
        projectIssues={[issue, subtask, target]}
        onOpenIssue={vi.fn()}
        onCreateIssue={vi.fn()}
        onMoveIssue={onMoveIssue}
        onMakeSubtask={onMakeSubtask}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Subtasks for ALPHA-1001" }));
    const source = screen.getByRole("button", { name: /Open subtask ALPHA-1002/ });
    const targetCard = screen.getByRole("button", { name: /^ALPHA-1003/ });
    fireDragEvent("dragstart", source, dataTransfer);
    expect(screen.getAllByText(/Drop here to make a standalone task/)).toHaveLength(3);
    const parentCard = screen.getByRole("button", { name: /^ALPHA-1001/ });
    fireDragEvent("dragover", parentCard, dataTransfer);
    expect(dataTransfer.dropEffect).toBe("none");
    fireDragEvent("drop", parentCard, dataTransfer);
    expect(onMakeSubtask).not.toHaveBeenCalled();

    fireDragEvent("dragstart", source, dataTransfer);
    fireDragEvent("dragover", targetCard, dataTransfer);
    expect(dataTransfer.dropEffect).toBe("move");
    expect(targetCard.parentElement).toHaveClass("issue-drop-target");
    fireDragEvent("drop", targetCard, dataTransfer);
    expect(onMakeSubtask).toHaveBeenCalledWith(subtask.key, target.key);
    expect(onMoveIssue).not.toHaveBeenCalled();
    expect(screen.queryByText(/Drop here to make a standalone task/)).not.toBeInTheDocument();

    onMakeSubtask.mockClear();
    fireDragEvent("dragstart", source, dataTransfer);
    fireDragEvent("drop", screen.getByText("Drop here to make a standalone task in Done"), dataTransfer);
    expect(onMoveIssue).toHaveBeenCalledWith(subtask.key, "Done");
    expect(onMakeSubtask).not.toHaveBeenCalled();

    fireDragEvent("dragstart", source, dataTransfer);
    fireDragEvent("dragend", source, dataTransfer);
    expect(screen.queryByText(/Drop here to make a standalone task/)).not.toBeInTheDocument();
    fireDragEvent("dragstart", source, dataTransfer);
    dataTransfer.setData("text/plain", "OTHER-1001");
    fireDragEvent("drop", targetCard, dataTransfer);
    expect(onMakeSubtask).not.toHaveBeenCalled();
    fireDragEvent("dragstart", source, dataTransfer);
    dataTransfer.setData("text/plain", "OTHER-1001");
    fireDragEvent("drop", screen.getByText("Drop here to make a standalone task in Done"), dataTransfer);
    expect(onMoveIssue).toHaveBeenCalledTimes(1);
    expect(onMakeSubtask).not.toHaveBeenCalled();
  });

  it("requests confirmation for an internal card drop without moving its status", () => {
    const target: Issue = { ...issue, key: "ALPHA-1002", issueType: "Task", status: "Done" };
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    const onMoveIssue = vi.fn();
    const onMakeSubtask = vi.fn();
    render(
      <IssueBoard
        issues={[issue, target]}
        projectIssues={[issue, target]}
        onOpenIssue={vi.fn()}
        onCreateIssue={vi.fn()}
        onMoveIssue={onMoveIssue}
        onMakeSubtask={onMakeSubtask}
      />,
    );
    const sourceCard = screen.getByRole("button", { name: /ALPHA-1001/ });
    const targetCard = screen.getByRole("button", { name: /ALPHA-1002/ });
    fireDragEvent("dragstart", sourceCard, dataTransfer);
    fireDragEvent("dragover", targetCard, dataTransfer);
    expect(targetCard.parentElement).toHaveClass("issue-drop-target");
    fireDragEvent("drop", targetCard, dataTransfer);
    expect(onMakeSubtask).toHaveBeenCalledWith("ALPHA-1001", "ALPHA-1002");
    expect(onMoveIssue).not.toHaveBeenCalled();

    onMakeSubtask.mockClear();
    fireDragEvent("dragstart", sourceCard, dataTransfer);
    fireDragEvent("drop", sourceCard, dataTransfer);
    expect(onMakeSubtask).not.toHaveBeenCalled();
    expect(onMoveIssue).not.toHaveBeenCalled();
    fireDragEvent("drop", targetCard, dataTransfer);
    expect(onMakeSubtask).not.toHaveBeenCalled();

    fireDragEvent("dragstart", sourceCard, dataTransfer);
    dataTransfer.setData("text/plain", "OTHER-1001");
    fireDragEvent("drop", targetCard, dataTransfer);
    expect(onMakeSubtask).not.toHaveBeenCalled();
    expect(onMoveIssue).not.toHaveBeenCalled();
  });
});
