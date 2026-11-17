import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Jira Simulator", () => {
  it("uses neutral Jira Simulator branding and a generic demo project", () => {
    render(<App />);

    expect(screen.getByRole("img", { name: "Jira Simulator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Demo Project" })).toBeInTheDocument();
    expect(screen.getByText("Add health check endpoint")).toBeInTheDocument();
    expect(screen.queryByText("Local demo")).not.toBeInTheDocument();
    expect(screen.queryByText("Getting started")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Workspace admin")).not.toBeInTheDocument();
    expect(screen.queryByText("A calmer way to keep work moving")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Workspace navigation" }),
    ).not.toBeInTheDocument();
  });

  it("shows the example subtasks under their Story and opens their details", async () => {
    const user = userEvent.setup();
    render(<App />);

    const toggle = screen.getByRole("button", { name: "Subtasks for DEMO-1001" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);

    const firstSubtask = screen.getByRole("button", {
      name: "Open subtask DEMO-1008: Implement dependency health checks (To Do)",
    });
    expect(firstSubtask).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Open subtask DEMO-1009: Define health response format (Done)",
    })).toBeInTheDocument();
    await user.click(firstSubtask);
    expect(screen.getByRole("button", {
      name: "Open parent story DEMO-1001: Add health check endpoint",
    })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit issue" }));
    const dialog = screen.getByRole("dialog", { name: "Edit issue" });
    const summary = within(dialog).getByRole("textbox", { name: /Summary/ });
    await user.clear(summary);
    await user.type(summary, "Edited subtask");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("heading", { name: "Edited subtask" })).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Open parent story DEMO-1001: Add health check endpoint",
    })).toBeInTheDocument();
  });

  it("only shows top-level cards on the board while retaining subtasks in the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("button", { name: /^DEMO-1008/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^DEMO-1009/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^DEMO-1007/ })).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 7 of 7 issues");
    expect(within(screen.getByRole("region", { name: "To Do issues" })).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Done issues" })).getByText("2")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "Done");
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 3 of 7 top-level issues · 1 matching subtask");
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1009/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", {
      name: "Open issue DEMO-1009: Define health response format",
    })).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 3 of 9 issues");
  });

  it("shows the parent column for the selected project even when subtasks are filtered out", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "List" }));
    const subtaskRow = screen.getByRole("button", { name: /Open issue DEMO-1008/ }).closest("tr");
    expect(subtaskRow).not.toBeNull();
    if (!subtaskRow) throw new Error("Subtask row not found.");
    expect(within(subtaskRow).getByRole("cell", { name: "DEMO-1001" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search issues" }), "DEMO-1002");
    expect(screen.getByRole("columnheader", { name: "Subtask of" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open issue DEMO-1008/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create project" }));
    const dialog = screen.getByRole("dialog", { name: "Create project" });
    await user.type(within(dialog).getByRole("textbox", { name: /Project name/ }), "Alpha Project");
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));
    await user.click(screen.getByRole("button", { name: "List" }));
    expect(screen.queryByRole("columnheader", { name: "Subtask of" })).not.toBeInTheDocument();
  });

  it("finds matching subtasks under their parent and combines search and status filters", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = screen.getByRole("searchbox", { name: "Search issues" });
    const status = screen.getByRole("combobox", { name: "Filter by status" });
    await user.type(search, "DEMO-1008");
    const parent = screen.getByRole("region", { name: "In Progress issues" });
    expect(within(parent).getByRole("button", { name: /^DEMO-1001/ })).toHaveTextContent("Shown for matching subtask");
    expect(within(parent).getByRole("button", { name: /Subtasks for DEMO-1001/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(parent).getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open subtask DEMO-1009/ })).not.toBeInTheDocument();
    await user.selectOptions(status, "Done");
    expect(screen.queryByRole("button", { name: /^DEMO-1001/ })).not.toBeInTheDocument();
    await user.selectOptions(status, "To Do");
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: "Subtasks for DEMO-1001" })).toHaveAttribute("aria-expanded", "false");
  });

  it("explains when a matching Story has no matching subtasks", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("searchbox", { name: "Search issues" }), "DEMO-1001");
    const toggle = screen.getByRole("button", { name: "Subtasks for DEMO-1001, 0 of 2 match" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByText("No subtasks match the filters.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open subtask DEMO-1008/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toHaveTextContent("0 matching subtasks");
  });

  it("preserves manual expansion when filtering hides the Story and until it is manually closed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    const search = screen.getByRole("searchbox", { name: "Search issues" });
    await user.type(search, "no matching issue");
    expect(screen.queryByRole("button", { name: /Subtasks for DEMO-1001/ })).not.toBeInTheDocument();
    await user.clear(search);
    const toggle = screen.getByRole("button", { name: "Subtasks for DEMO-1001" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeVisible();
    await user.click(toggle);
    await user.type(search, "DEMO-1008");
    expect(screen.getByRole("button", { name: /Subtasks for DEMO-1001/ })).toHaveAttribute("aria-expanded", "true");
    await user.clear(search);
    expect(screen.getByRole("button", { name: "Subtasks for DEMO-1001" })).toHaveAttribute("aria-expanded", "false");
  });

  it("remembers a manual close while filtering, and a later manual reopen", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = screen.getByRole("searchbox", { name: "Search issues" });
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    await user.type(search, "DEMO-1008");
    let toggle = screen.getByRole("button", { name: /Subtasks for DEMO-1001/ });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.clear(search);
    expect(screen.getByRole("button", { name: "Subtasks for DEMO-1001" })).toHaveAttribute("aria-expanded", "false");
    await user.type(search, "DEMO-1008");
    toggle = screen.getByRole("button", { name: /Subtasks for DEMO-1001/ });
    await user.click(toggle);
    await user.click(toggle);
    await user.clear(search);
    expect(screen.getByRole("button", { name: "Subtasks for DEMO-1001" })).toHaveAttribute("aria-expanded", "true");
  });

  it("preserves expansion manually opened during filtering across views and project renaming", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = screen.getByRole("searchbox", { name: "Search issues" });
    await user.type(search, "DEMO-1001");
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001, 0 of 2 match" }));
    await user.clear(search);
    expect(screen.getByRole("button", { name: "Subtasks for DEMO-1001" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "List" }));
    await user.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.getByRole("button", { name: "Subtasks for DEMO-1001" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Edit project" }));
    const dialog = screen.getByRole("dialog", { name: "Edit project" });
    const name = within(dialog).getByRole("textbox", { name: /Project name/ });
    await user.clear(name);
    await user.type(name, "Updated Project");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Subtasks for UPDATED-1001" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Open subtask UPDATED-1008/ })).toBeVisible();
  });

  it("exposes navigation, view controls, board columns, and project progress to assistive technology", () => {
    render(<App />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Projects" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Project overview" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Issue view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "To Do issues" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Project progress" }),
    ).toBeInTheDocument();
  });

  it("shows a issue's details and acceptance criteria", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^DEMO-1001/ }));

    expect(
      screen.getByRole("dialog", { name: "Add health check endpoint" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Add health check endpoint",
      }),
    ).toHaveFocus();
    expect(
      screen.getByText(
        "The endpoint returns a healthy response when required dependencies are available",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The response does not expose connection details or credentials",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Add health check endpoint" }),
    ).toBeInTheDocument();
  });

  it("searches issue text and switches between board and list views", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("searchbox", { name: "Search issues" }), "security");

    expect(screen.getByRole("button", { name: /DEMO-1002/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /DEMO-1007/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /DEMO-1001/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.click(screen.getByRole("button", { name: "List" }));

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Open issue DEMO-1001/ })).toBeInTheDocument();
  });

  it("moves an issue between board columns with drag and drop", () => {
    render(<App />);

    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    const drag = (type: string, element: Element) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      fireEvent(element, event);
    };

    const issue = screen.getByRole("button", { name: /DEMO-1002/ });
    const toDoColumn = screen.getByRole("region", { name: "To Do issues" });
    const inProgressColumn = screen.getByRole("region", {
      name: "In Progress issues",
    });

    drag("dragstart", issue);
    drag("dragover", inProgressColumn);
    drag("drop", inProgressColumn);

    expect(
      within(inProgressColumn).getByRole("button", { name: /DEMO-1002/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Issue DEMO-1002 moved to In Progress.",
    );
    expect(
      within(toDoColumn).queryByRole("button", { name: /DEMO-1002/ }),
    ).not.toBeInTheDocument();
  });

  it("detaches a dragged subtask into the chosen column without changing its sibling", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    const subtask = screen.getByRole("button", { name: /Open subtask DEMO-1008/ });
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    fireEvent.dragStart(subtask, { dataTransfer });
    fireEvent.drop(screen.getByText("Drop here to make a standalone task in Done"), { dataTransfer });

    let dialog = screen.getByRole("dialog", { name: "Make subtask standalone?" });
    expect(within(dialog).getByRole("combobox", { name: "Destination column" })).toHaveValue("Done");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Destination column" }), "To Do");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(subtask).toBeInTheDocument();
    expect(subtask).toHaveAccessibleName(/To Do/);
    expect(screen.queryByRole("button", { name: /^DEMO-1008/ })).not.toBeInTheDocument();
    fireEvent.dragStart(subtask, { dataTransfer });
    fireEvent.drop(screen.getByText("Drop here to make a standalone task in Done"), { dataTransfer });
    dialog = screen.getByRole("dialog", { name: "Make subtask standalone?" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Destination column" }), "In Progress");
    await user.click(within(dialog).getByRole("button", { name: "Make standalone task" }));
    expect(screen.getByRole("status")).toHaveTextContent("Issue DEMO-1008 is now a standalone Task in In Progress.");
    expect(screen.queryByRole("button", { name: /Open subtask DEMO-1008/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1009/ })).toBeInTheDocument();
    const standalone = within(screen.getByRole("region", { name: "In Progress issues" }))
      .getByRole("button", { name: /^DEMO-1008/ });
    await user.click(standalone);
    expect(screen.getByRole("heading", { name: "Implement dependency health checks" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("In Progress");
    expect(screen.queryByRole("button", { name: /Open parent story/ })).not.toBeInTheDocument();
    expect(screen.getByText("Required dependencies are checked without exposing connection details")).toBeInTheDocument();
  });

  it("makes a subtask standalone from its details without changing its status", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    await user.click(screen.getByRole("button", { name: /Open subtask DEMO-1008/ }));
    await user.click(screen.getByRole("button", { name: "Make standalone task" }));
    let dialog = screen.getByRole("dialog", { name: "Make subtask standalone?" });
    expect(within(dialog).getByRole("combobox", { name: "Destination column" })).toHaveValue("To Do");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Destination column" }), "Done");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Make standalone task" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Open parent story/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
    await user.click(screen.getByRole("button", { name: "Make standalone task" }));
    dialog = screen.getByRole("dialog", { name: "Make subtask standalone?" });
    await user.click(within(dialog).getByRole("button", { name: "Make standalone task" }));
    expect(screen.getByRole("heading", { name: "Implement dependency health checks" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
    expect(screen.queryByRole("button", { name: /Open parent story/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Make standalone task" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Issue DEMO-1008 is now a standalone Task in To Do.");
    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    expect(screen.getByRole("searchbox", { name: "Search issues" })).toHaveFocus();
    expect(within(screen.getByRole("region", { name: "To Do issues" })).getByRole("button", { name: /^DEMO-1008/ })).toBeInTheDocument();
  });

  it("detaches a subtask even when it is dropped into its current status", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    const subtask = screen.getByRole("button", { name: /Open subtask DEMO-1009/ });
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    fireEvent.dragStart(subtask, { dataTransfer });
    fireEvent.drop(screen.getByText("Drop here to make a standalone task in Done"), { dataTransfer });
    await user.click(within(screen.getByRole("dialog", { name: "Make subtask standalone?" })).getByRole("button", { name: "Make standalone task" }));
    expect(screen.getByRole("status")).toHaveTextContent("Issue DEMO-1009 is now a standalone Task in Done.");
    expect(within(screen.getByRole("region", { name: "Done issues" })).getByRole("button", { name: /^DEMO-1009/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeInTheDocument();
  });

  it("reparents a subtask after confirmation and preserves both statuses and siblings", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    const source = screen.getByRole("button", { name: /Open subtask DEMO-1008/ });
    const target = screen.getByRole("button", { name: /^DEMO-1006/ });
    const storedValues = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (format: string, value: string) => storedValues.set(format, value),
      getData: (format: string) => storedValues.get(format) ?? "",
    };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    let dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    expect(dialog).toHaveAccessibleDescription(/DEMO-1008 will be moved from DEMO-1001/);
    expect(within(dialog).getByRole("status")).toHaveTextContent("DEMO-1006 will become a Story");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(source).toBeInTheDocument();
    expect(target).toHaveTextContent("Bug");

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    expect(within(dialog).getByRole("combobox", { name: "Parent issue" })).not.toHaveTextContent("DEMO-1001");
    await user.click(within(dialog).getByRole("button", { name: "Make subtask" }));
    expect(screen.queryByRole("button", { name: /Open subtask DEMO-1008/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1009/ })).toBeInTheDocument();
    expect(target).toHaveTextContent("Story");
    expect(within(screen.getByRole("region", { name: "Done issues" })).getByRole("button", { name: /^DEMO-1006/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1006" }));
    await user.click(screen.getByRole("button", { name: /Open subtask DEMO-1008/ }));
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
    expect(screen.getByRole("button", { name: /Open parent story DEMO-1006/ })).toBeInTheDocument();
    expect(screen.getByText("Required dependencies are checked without exposing connection details")).toBeInTheDocument();
  });

  it("offers a non-drag way to move a subtask and restores the correct action on cancel", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Subtasks for DEMO-1001" }));
    await user.click(screen.getByRole("button", { name: /Open subtask DEMO-1008/ }));
    await user.click(screen.getByRole("button", { name: "Move subtask" }));
    let dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    const parent = within(dialog).getByRole("combobox", { name: "Parent issue" });
    expect(parent).not.toHaveTextContent("DEMO-1001");
    await user.selectOptions(parent, "DEMO-1005");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Move subtask" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Open parent story DEMO-1001/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move subtask" }));
    dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Parent issue" }), "DEMO-1005");
    await user.click(within(dialog).getByRole("button", { name: "Make subtask" }));
    expect(screen.getByRole("heading", { name: "Implement dependency health checks" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Open parent story DEMO-1005/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
  });

  it("creates a project and creates issues under that project", async () => {
    const user = userEvent.setup();
    const projectName = 'Alpha Project <img src=x onerror="alert(1)">';
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create project" }));
    const dialog = screen.getByRole("dialog", { name: "Create project" });
    const projectNameField = within(dialog).getByRole("textbox", { name: /Project name/ });
    await user.type(projectNameField, "Demo Workspace");
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/prefix DEMO/);

    await user.clear(projectNameField);
    await user.type(projectNameField, projectName);
    await user.click(within(dialog).getByRole("button", { name: "Create project" }));

    expect(screen.getByRole("heading", { name: projectName })).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /DEMO-1001/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create issue" }));
    const issueDialog = screen.getByRole("dialog", { name: "Create an issue" });
    await user.type(
      within(issueDialog).getByRole("textbox", { name: /Summary/ }),
      "Add project-specific validation",
    );
    await user.click(
      within(issueDialog).getByRole("button", { name: "Create issue" }),
    );

    expect(
      within(screen.getByRole("region", { name: "To Do issues" })).getByRole(
        "button",
        { name: /ALPHA-1001/ },
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    await user.click(
      screen.getByRole("button", { name: "Select Demo Project project" }),
    );
    expect(screen.getByRole("heading", { name: "Demo Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^DEMO-1001/ })).toBeInTheDocument();
  });

  it("renames a project and updates its issue keys", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Edit project" }));
    const dialog = screen.getByRole("dialog", { name: "Edit project" });
    const projectName = within(dialog).getByRole("textbox", { name: /Project name/ });
    await user.clear(projectName);
    await user.type(projectName, "Updated Project");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("heading", { name: "Updated Project" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^UPDATED-1001/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /DEMO-1001/ }),
    ).not.toBeInTheDocument();
  });

  it("creates issues, assigns the next key, updates status, and renders input as text", async () => {
    const user = userEvent.setup();
    const summary = '<img src=x onerror="alert(1)"> New validation rule';
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Create issue" }));
    const dialog = screen.getByRole("dialog", { name: "Create an issue" });
    await user.type(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
      summary,
    );
    await user.type(
      within(dialog).getByPlaceholderText("Add a little more context..."),
      "Describe the new rule.",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Issue type"),
      "Bug",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Priority"),
      "Highest",
    );
    await user.type(
      within(dialog).getByPlaceholderText("e.g. backend, demo"),
      "backend, demo",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: /Acceptance criteria/ }),
      "Rule accepts valid values\nInvalid values are rejected",
    );
    await user.click(within(dialog).getByRole("button", { name: "Create issue" }));

    expect(screen.getByRole("heading", { name: summary })).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).not.toBeInTheDocument();
    expect(screen.getByText("Rule accepts valid values")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "To Do issues" })).getByRole(
        "button",
        { name: /DEMO-1010/ },
      ),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Change issue status" }),
      "Done",
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Issue DEMO-1010 moved to Done.",
    );
    expect(
      within(screen.getByRole("region", { name: "Done issues" })).getByRole(
        "button",
        { name: /DEMO-1010/ },
      ),
    ).toBeInTheDocument();
  });

  it("creates Task subtasks from a Story and shows their parent relationship", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^DEMO-1001/ }));
    await user.click(
      screen.getByRole("button", { name: "Add subtask to DEMO-1001" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Create a subtask" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).getByText("Task")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: "Issue type" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Control>}k{/Control}");
    expect(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
    ).toHaveFocus();

    await user.type(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
      "Add health response mapping",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create subtask" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Add health check endpoint" }),
    ).toBeInTheDocument();
    const subtaskButton = screen.getByRole("button", {
      name: "Open subtask DEMO-1010: Add health response mapping (To Do)",
    });
    expect(subtaskButton).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "To Do issues" }))
      .queryByRole("button", { name: /^DEMO-1010/ })).not.toBeInTheDocument();

    await user.click(subtaskButton);

    expect(
      screen.getByRole("button", {
        name: "Open parent story DEMO-1001: Add health check endpoint",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add subtask/ }),
    ).not.toBeInTheDocument();
  });

  it("updates subtask parent keys when the project is renamed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^DEMO-1001/ }));
    await user.click(
      screen.getByRole("button", { name: "Add subtask to DEMO-1001" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Create a subtask" });
    await user.type(
      within(dialog).getByRole("textbox", { name: /Summary/ }),
      "Add a health response test",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Create subtask" }),
    );
    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    await user.click(screen.getByRole("button", { name: "Edit project" }));

    const projectDialog = screen.getByRole("dialog", { name: "Edit project" });
    const projectName = within(projectDialog).getByRole("textbox", {
      name: /Project name/,
    });
    await user.clear(projectName);
    await user.type(projectName, "Updated Project");
    await user.click(
      within(projectDialog).getByRole("button", { name: "Save changes" }),
    );
    await user.click(screen.getByRole("button", { name: "Subtasks for UPDATED-1001" }));
    await user.click(screen.getByRole("button", {
      name: "Open subtask UPDATED-1010: Add a health response test (To Do)",
    }));

    expect(
      screen.getByRole("button", {
        name: "Open parent story UPDATED-1001: Add health check endpoint",
      }),
    ).toBeInTheDocument();
  });

  it("edits all issue fields while preserving identity, status and safe text rendering", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /^DEMO-1002/ }));
    await user.click(screen.getByRole("button", { name: "Edit issue" }));
    const dialog = screen.getByRole("dialog", { name: "Edit issue" });
    const summary = within(dialog).getByRole("textbox", { name: /Summary/ });
    await user.clear(summary);
    await user.type(summary, '<img src=x onerror="alert(1)"> edited');
    const description = within(dialog).getByRole("textbox", { name: "Description" });
    await user.clear(description);
    await user.type(description, "Updated description");
    await user.selectOptions(within(dialog).getByLabelText("Issue type"), "Bug");
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "Low");
    const labels = within(dialog).getByRole("textbox", { name: /Labels/ });
    await user.clear(labels);
    await user.type(labels, "updated, example");
    const criteria = within(dialog).getByRole("textbox", { name: /Acceptance criteria/ });
    await user.clear(criteria);
    await user.type(criteria, "Updated criterion");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("heading", { name: '<img src=x onerror="alert(1)"> edited' })).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).not.toBeInTheDocument();
    expect(screen.getByText("Updated description")).toBeInTheDocument();
    expect(screen.getByText("Updated criterion")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
    expect(screen.getByRole("button", { name: "Edit issue" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    expect(screen.getByRole("button", { name: /^DEMO-1002/ })).toHaveTextContent("Bug");
    expect(screen.getByRole("button", { name: /^DEMO-1002/ })).toHaveTextContent("Low");
    expect(screen.getByRole("button", { name: /^DEMO-1002/ })).toHaveTextContent("updated");
  });

  it("detaches a Story's subtasks only after saving a different issue type", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /^DEMO-1001/ }));
    await user.click(screen.getByRole("button", { name: "Edit issue" }));
    let dialog = screen.getByRole("dialog", { name: "Edit issue" });
    await user.selectOptions(within(dialog).getByLabelText("Issue type"), "Bug");
    expect(within(dialog).getByRole("status")).toHaveTextContent("detach the subtasks");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit issue" })).toHaveFocus();
    expect(screen.getByRole("button", {
      name: "Open subtask DEMO-1008: Implement dependency health checks (To Do)",
    })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit issue" }));
    dialog = screen.getByRole("dialog", { name: "Edit issue" });
    await user.selectOptions(within(dialog).getByLabelText("Issue type"), "Bug");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("In Progress");
    expect(screen.queryByRole("region", { name: "Subtasks" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    await user.click(screen.getByRole("button", { name: /^DEMO-1008/ }));
    expect(screen.queryByRole("button", { name: /Open parent story/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    expect(screen.getByRole("button", { name: /^DEMO-1009/ })).toBeInTheDocument();
  });

  it("links a Story using the non-drag action and warns before detaching its subtasks", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /^DEMO-1001/ }));
    await user.click(screen.getByRole("button", { name: "Make subtask" }));
    let dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Parent issue" }), "DEMO-1007");
    expect(within(dialog).getByRole("status")).toHaveTextContent("DEMO-1007 will become a Story");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Existing subtasks of DEMO-1001 will become standalone Tasks");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Make subtask" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Make subtask" }));
    dialog = screen.getByRole("dialog", { name: "Make issue a subtask?" });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Parent issue" }), "DEMO-1007");
    await user.click(within(dialog).getByRole("button", { name: "Make subtask" }));
    expect(screen.getByRole("status")).toHaveTextContent("Issue DEMO-1001 is now a subtask of DEMO-1007.");
    expect(screen.getByRole("combobox", { name: "Change issue status" })).toHaveValue("In Progress");
    const breadcrumb = screen.getByRole("navigation", { name: "Issue breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Demo Project / DEMO-1007 / DEMO-1001");
    await user.click(within(breadcrumb).getByRole("button", { name: /Open parent story DEMO-1007/ }));
    expect(screen.getByRole("heading", { name: "Prepare agent workspace isolation" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Open subtask DEMO-1001/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close issue details" }));
    expect(screen.getByRole("button", { name: /^DEMO-1008/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^DEMO-1009/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^DEMO-1001/ })).not.toBeInTheDocument();
  });
});
