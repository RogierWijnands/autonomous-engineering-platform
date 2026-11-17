import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Issue } from "../../types";
import { MakeStandaloneDialog } from "./MakeStandaloneDialog";

const subtask: Issue = {
  key: "ALPHA-1002",
  projectId: "alpha",
  parentIssueKey: "ALPHA-1001",
  summary: "Validate input",
  description: "",
  issueType: "Task",
  priority: "Medium",
  status: "To Do",
  labels: [],
  acceptanceCriteria: [],
};

describe("MakeStandaloneDialog", () => {
  it("explains the change and confirms the selected destination", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <MakeStandaloneDialog issue={subtask} initialStatus="Done" onConfirm={onConfirm} onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog", { name: "Make subtask standalone?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("ALPHA-1002: Validate input This will remove the subtask from ALPHA-1001 and make it a standalone Task.");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    const destination = within(dialog).getByRole("combobox", { name: "Destination column" });
    expect(destination).toHaveValue("Done");
    await user.selectOptions(destination, "In Progress");
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Make standalone task" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith("In Progress");
  });

  it("cancels without confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<MakeStandaloneDialog issue={subtask} initialStatus="To Do" onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
