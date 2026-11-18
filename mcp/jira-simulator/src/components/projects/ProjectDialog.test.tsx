import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "../../types";
import { ProjectDialog } from "./ProjectDialog";

const existingProject: Project = {
  id: "project-demo",
  name: "Demo Project",
};

describe("ProjectDialog", () => {
  it("requests deletion without submitting the current project draft", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onSave = vi.fn();
    render(
      <ProjectDialog
        project={existingProject}
        projects={[existingProject]}
        onDelete={onDelete}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const name = screen.getByRole("textbox", { name: /Project name/ });
    await user.clear(name);
    await user.type(name, "Unsaved name");
    await user.click(screen.getByRole("button", { name: "Delete project" }));
    expect(onDelete).toHaveBeenCalledWith({
      name: "Unsaved name",
      repository: "",
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("trims a new project name before saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectDialog
        projects={[existingProject]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Create project" });

    await user.type(
      within(dialog).getByRole("textbox", { name: /Project name/ }),
      "  Alpha Project  ",
    );
    await user.type(
      within(dialog).getByRole("textbox", {
        name: "Default GitHub repository",
      }),
      "owner/repo",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(onSave).toHaveBeenCalledWith({
      name: "Alpha Project",
      repository: "owner/repo",
    });
  });

  it("requires and validates the default repository", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectDialog
        project={existingProject}
        projects={[existingProject]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const repository = screen.getByRole("textbox", {
      name: "Default GitHub repository",
    });
    expect(repository).toBeRequired();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(repository).toHaveFocus();
    expect(repository).toHaveAttribute("aria-invalid", "true");
    expect(onSave).not.toHaveBeenCalled();
    await user.type(repository, "https://example.com/repo");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(repository).toHaveFocus();
    expect(repository).toHaveAttribute("aria-invalid", "true");
    expect(onSave).not.toHaveBeenCalled();
    await user.clear(repository);
    await user.type(repository, " owner/project ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith({
      name: "Demo Project",
      repository: "owner/project",
    });
  });

  it("rejects names whose derived issue-ID prefix is already in use", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectDialog
        projects={[existingProject]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Create project" });

    await user.type(
      within(dialog).getByRole("textbox", { name: /Project name/ }),
      "Demo Workspace",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Another project already uses the issue-ID prefix DEMO. Choose a different name.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects invalid prefixes and duplicate project names", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ProjectDialog
        projects={[existingProject]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Create project" });
    const projectName = within(dialog).getByRole("textbox", {
      name: /Project name/,
    });

    await user.type(projectName, "A");
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Use a project name that produces a 2-10 character prefix starting with a letter.",
    );

    await user.clear(projectName);
    await user.type(projectName, "123 Project");
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Use a project name that produces a 2-10 character prefix starting with a letter.",
    );

    await user.clear(projectName);
    await user.type(projectName, "demo project");
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "A project with that name already exists.",
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
