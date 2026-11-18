import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Issue, Project, IssueDraft } from "../../types";
import { IssueDialog } from "./IssueDialog";

const project: Project = {
  id: "project-alpha",
  name: "Alpha Project",
};

const parentStory: Issue = {
  key: "ALPHA-1001",
  projectId: project.id,
  summary: "Implement validation",
  description: "",
  issueType: "Story",
  priority: "Medium",
  status: "To Do",
  labels: [],
  acceptanceCriteria: [],
};

describe("IssueDialog", () => {
  it("normalizes issue fields and splits labels and acceptance criteria", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<(draft: IssueDraft) => void>();
    render(
      <IssueDialog
        project={project}
        initialStatus="Done"
        onSave={onCreate}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Create an issue" });
    expect(dialog).toHaveAccessibleDescription(
      "Project: Alpha Project · Status: Done",
    );
    expect(
      within(dialog).getByText("Project: Alpha Project · Status: Done"),
    ).toBeInTheDocument();

    await user.type(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
      "  Add validation  ",
    );
    await user.type(
      within(dialog).getByPlaceholderText("Add a little more context..."),
      "  Reject malformed input  ",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Issue type"),
      "Bug",
    );
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "High");
    await user.type(
      within(dialog).getByPlaceholderText("e.g. backend, demo"),
      " backend, security , ",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /Acceptance criteria/ }),
      " Valid values are accepted \n\n Invalid values are rejected ",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create issue" }),
    );

    expect(onCreate).toHaveBeenCalledWith({
      summary: "Add validation",
      description: "Reject malformed input",
      issueType: "Bug",
      priority: "High",
      labels: ["backend", "security"],
      acceptanceCriteria: [
        "Valid values are accepted",
        "Invalid values are rejected",
      ],
    });
  });

  it("locks a subtask to Task and submits the parent context separately", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<(draft: IssueDraft) => void>();
    render(
      <IssueDialog
        project={project}
        parentIssue={parentStory}
        onSave={onCreate}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Create a subtask" });

    expect(
      within(dialog).getByText("Subtask of ALPHA-1001"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Task")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: "Issue type" }),
    ).not.toBeInTheDocument();

    await user.type(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
      "Add request validation",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create subtask" }),
    );

    expect(onCreate).toHaveBeenCalledWith({
      summary: "Add request validation",
      description: "",
      issueType: "Task",
      priority: "Medium",
      labels: [],
      acceptanceCriteria: [],
    });
  });

  it("prefills editable fields and warns before changing a Story with subtasks", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(draft: IssueDraft) => void>();
    render(
      <IssueDialog
        project={project}
        issue={{
          ...parentStory,
          labels: ["backend", "demo"],
          acceptanceCriteria: ["First", "Second"],
        }}
        hasSubtasks
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit issue" });
    expect(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
    ).toHaveValue("Implement validation");
    expect(within(dialog).getByLabelText("Issue type")).toHaveValue("Story");
    expect(within(dialog).getByLabelText("Priority")).toHaveValue("Medium");
    expect(within(dialog).getByRole("textbox", { name: /Labels/ })).toHaveValue(
      "backend, demo",
    );
    expect(
      within(dialog).getByRole("textbox", { name: /Acceptance criteria/ }),
    ).toHaveValue("First\nSecond");

    await user.selectOptions(
      within(dialog).getByLabelText("Issue type"),
      "Bug",
    );
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "detach the subtasks",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Issue type"),
      "Story",
    );
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    await user.selectOptions(
      within(dialog).getByLabelText("Issue type"),
      "Task",
    );
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "High");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(onSave).toHaveBeenCalledWith({
      summary: "Implement validation",
      description: "",
      issueType: "Task",
      priority: "High",
      labels: ["backend", "demo"],
      acceptanceCriteria: ["First", "Second"],
    });
  });

  it("keeps an existing subtask's type locked when edited", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(draft: IssueDraft) => void>();
    render(
      <IssueDialog
        project={project}
        issue={{
          ...parentStory,
          key: "ALPHA-1002",
          issueType: "Task",
          parentIssueKey: parentStory.key,
        }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit issue" });
    expect(
      within(dialog).queryByLabelText("Issue type"),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText("Task")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ issueType: "Task" }),
    );
  });

  it("rejects a whitespace-only summary and allows correction", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn<(draft: IssueDraft) => void>();
    render(
      <IssueDialog
        project={project}
        issue={parentStory}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit issue" });
    const summary = within(dialog).getByRole("textbox", { name: /Summary/ });
    await user.clear(summary);
    await user.type(summary, "   ");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute("aria-invalid", "true");
    expect(summary).toHaveAccessibleDescription("Enter a summary.");
    await user.type(summary, "Valid summary");
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "Valid summary" }),
    );
  });
});
