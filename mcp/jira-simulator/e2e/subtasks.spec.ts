import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragIssueOntoIssue(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("Source issue is not visible.");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y + sourceBox.height / 2, { steps: 5 });
  await expect(page.getByText(/Drop here to move/).first()).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("Target issue is not visible.");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

test("warns before detaching subtasks when a Story changes type", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await page.getByRole("button", { name: "Edit issue" }).click();
  let dialog = page.getByRole("dialog", { name: "Edit issue" });
  await dialog.getByRole("combobox", { name: "Issue type" }).selectOption("Task");
  await expect(dialog.getByRole("status")).toContainText("detach the subtasks");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeVisible();

  await page.getByRole("button", { name: "Edit issue" }).click();
  dialog = page.getByRole("dialog", { name: "Edit issue" });
  await dialog.getByRole("combobox", { name: "Issue type" }).selectOption("Bug");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("region", { name: "Subtasks" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("In Progress");
  await page.getByRole("button", { name: "Close issue details" }).click();
  await expect(page.getByRole("button", { name: /^DEMO-1008/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^DEMO-1009/ })).toBeVisible();
  await page.getByRole("button", { name: /^DEMO-1008/ }).click();
  await expect(page.getByRole("button", { name: /Open parent story/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit issue" }).click();
  await expect(page.getByRole("dialog", { name: "Edit issue" }).getByLabel("Issue type")).toHaveValue("Task");
});

test("creates a Task subtask under a Story", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".issue-card").filter({ hasText: "DEMO-1008" })).toHaveCount(0);
  await expect(page.locator(".issue-card").filter({ hasText: "DEMO-1009" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^DEMO-1007/ })).toBeVisible();
  await expect(page.locator(".board-footer")).toHaveText(/Showing 7 of 7 issues/);
  const toggle = page.getByRole("button", { name: "Subtasks for DEMO-1001" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", {
    name: "Open subtask DEMO-1008: Implement dependency health checks (To Do)",
  })).toBeVisible();
  await expect(page.getByRole("button", {
    name: "Open subtask DEMO-1009: Define health response format (Done)",
  })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await page.getByRole("button", { name: "Add subtask to DEMO-1001" }).click();

  const dialog = page.getByRole("dialog", { name: "Create a subtask" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  const summary = dialog.getByRole("textbox", { name: "Summary" });
  await expect(summary).toBeFocused();
  await expect(summary).toHaveAttribute("required", "");
  await expect(dialog.getByRole("combobox", { name: "Priority" })).toBeVisible();
  await expect(dialog.getByText("Task", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Issue type" }),
  ).toHaveCount(0);

  await summary.fill("Add browser-level subtask coverage");
  await dialog.getByRole("button", { name: "Create subtask" }).click();

  await expect(
    page.getByRole("button", {
      name: "Open subtask DEMO-1010: Add browser-level subtask coverage (To Do)",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".issue-card").filter({ hasText: "DEMO-1010" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close issue details" }).click();

  const subtask = page.getByRole("button", {
    name: "Open subtask DEMO-1010: Add browser-level subtask coverage (To Do)",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(subtask).toHaveCount(0);
  await page.getByRole("combobox", { name: "Filter by status" }).selectOption("In Progress");
  await expect(page.locator(".issue-card").filter({ hasText: "DEMO-1010" })).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(subtask).toBeVisible();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(subtask).toHaveCount(0);
  await toggle.click();
  await subtask.click();
  await expect(
    page.getByRole("button", {
      name: "Open parent story DEMO-1001: Add health check endpoint",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Add subtask/ })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Change issue status" }).selectOption("Done");
  await page.getByRole("button", { name: "Close issue details" }).click();
  await expect(page.getByRole("button", {
    name: "Open subtask DEMO-1010: Add browser-level subtask coverage (Done)",
  })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Edit project" }).click();
  const projectDialog = page.getByRole("dialog", { name: "Edit project" });
  await projectDialog.getByRole("textbox", { name: "Project name" }).fill("Updated Project");
  await projectDialog.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Subtasks for UPDATED-1001" }).click();
  await page.getByRole("button", {
    name: "Open subtask UPDATED-1010: Add browser-level subtask coverage (Done)",
  }).click();
  await expect(
    page.getByRole("button", {
      name: "Open parent story UPDATED-1001: Add health check endpoint",
    }),
  ).toBeVisible();
});

test("keeps subtasks searchable in list view without separate board cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search issues" }).fill("DEMO-1009");
  await expect(page.locator(".issue-card")).toHaveCount(0);
  await expect(page.locator(".board-footer")).toHaveText(/Showing 0 of 7 issues/);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("button", {
    name: "Open issue DEMO-1009: Define health response format",
  })).toBeVisible();
  await expect(page.locator(".board-footer")).toHaveText(/Showing 1 of 9 issues/);
});

test("drags a subtask to a column to make it standalone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Subtasks for DEMO-1001" }).click();
  const source = page.getByRole("button", { name: /Open subtask DEMO-1008/ });
  const target = page.getByRole("button", { name: /^DEMO-1007/ });

  async function beginDrag() {
    await source.scrollIntoViewIfNeeded();
    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Subtask is not visible.");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y + sourceBox.height / 2, { steps: 5 });
    await expect(page.getByText(/Drop here to make a standalone task/)).toHaveCount(3);
  }

  await beginDrag();
  await target.scrollIntoViewIfNeeded();
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("Target issue is not visible.");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await expect(target.locator("..")).toHaveClass(/issue-drop-target/);
  await page.mouse.up();
  const linkDialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await expect(linkDialog.getByRole("combobox", { name: "Parent issue" })).toHaveValue("DEMO-1007");
  await expect(linkDialog).toHaveAccessibleDescription(/DEMO-1008 will be moved from DEMO-1001/);
  await linkDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(source).toBeVisible();
  await expect(page.getByRole("button", { name: /^DEMO-1008/ })).toHaveCount(0);

  await beginDrag();
  const area = page.getByText("Drop here to make a standalone task in In Progress");
  await area.scrollIntoViewIfNeeded();
  const areaBox = await area.boundingBox();
  if (!areaBox) throw new Error("Column drop area is not visible.");
  await page.mouse.move(areaBox.x + areaBox.width / 2, areaBox.y + areaBox.height / 2, { steps: 10 });
  await page.mouse.up();
  let dialog = page.getByRole("dialog", { name: "Make subtask standalone?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(dialog.getByRole("combobox", { name: "Destination column" })).toHaveValue("In Progress");
  await dialog.getByRole("combobox", { name: "Destination column" }).selectOption("Done");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(source).toBeFocused();
  await expect(source).toBeVisible();
  await expect(source).toHaveAccessibleName(/To Do/);
  await expect(page.getByRole("button", { name: /^DEMO-1008/ })).toHaveCount(0);

  await beginDrag();
  await area.scrollIntoViewIfNeeded();
  const secondAreaBox = await area.boundingBox();
  if (!secondAreaBox) throw new Error("Column drop area is not visible.");
  await page.mouse.move(secondAreaBox.x + secondAreaBox.width / 2, secondAreaBox.y + secondAreaBox.height / 2, { steps: 10 });
  await page.mouse.up();
  dialog = page.getByRole("dialog", { name: "Make subtask standalone?" });
  await dialog.getByRole("combobox", { name: "Destination column" }).selectOption("Done");
  await dialog.getByRole("button", { name: "Make standalone task" }).click();
  await expect(page.getByRole("status")).toHaveText("Issue DEMO-1008 is now a standalone Task in Done.");
  await expect(page.getByRole("region", { name: "Done issues" }).getByRole("button", { name: /^DEMO-1008/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1008/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1009/ })).toBeVisible();
  await page.getByRole("button", { name: /^DEMO-1008/ }).click();
  await expect(page.getByRole("button", { name: /Open parent story/ })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("Done");
});

test("reparents a subtask onto an issue after confirmation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Subtasks for DEMO-1001" }).click();
  const source = page.getByRole("button", { name: /Open subtask DEMO-1008/ });
  const target = page.getByRole("button", { name: /^DEMO-1006/ });
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("Subtask is not visible.");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y + sourceBox.height / 2, { steps: 5 });
  await expect(page.getByText(/Drop here to make a standalone task/)).toHaveCount(3);
  await target.scrollIntoViewIfNeeded();
  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("Target issue is not visible.");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await expect(target.locator("..")).toHaveClass(/issue-drop-target/);
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await expect(dialog.getByRole("combobox", { name: "Parent issue" })).toHaveValue("DEMO-1006");
  await expect(dialog.getByRole("status")).toContainText("DEMO-1006 will become a Story");
  await dialog.getByRole("button", { name: "Make subtask" }).click();
  await expect(page.getByRole("status")).toHaveText("Issue DEMO-1008 is now a subtask of DEMO-1006.");
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1009/ })).toBeVisible();
  await expect(target).toContainText("Story");
  await page.getByRole("button", { name: "Subtasks for DEMO-1006" }).click();
  await page.getByRole("button", { name: /Open subtask DEMO-1008/ }).click();
  await expect(page.getByRole("button", { name: /Open parent story DEMO-1006/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
});

test("moves a subtask without dragging at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Subtasks for DEMO-1001" }).click();
  await page.getByRole("button", { name: /Open subtask DEMO-1008/ }).click();
  const move = page.getByRole("button", { name: "Move subtask" });
  await move.focus();
  await page.keyboard.press("Enter");
  let dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await expect(dialog.getByRole("combobox", { name: "Parent issue" })).toBeFocused();
  await expect(dialog.getByRole("combobox", { name: "Parent issue" })).not.toContainText("DEMO-1001");
  await dialog.getByRole("combobox", { name: "Parent issue" }).selectOption("DEMO-1005");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Move subtask" })).toBeFocused();
  await expect(page.getByRole("button", { name: /Open parent story DEMO-1001/ })).toBeVisible();
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await dialog.getByRole("combobox", { name: "Parent issue" }).selectOption("DEMO-1005");
  await dialog.getByRole("button", { name: "Make subtask" }).click();
  await expect(page.getByRole("button", { name: /Open parent story DEMO-1005/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("makes a subtask standalone without dragging at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Subtasks for DEMO-1001" }).click();
  await page.getByRole("button", { name: /Open subtask DEMO-1009/ }).click();
  const action = page.getByRole("button", { name: "Make standalone task" });
  await action.focus();
  await page.keyboard.press("Enter");
  let dialog = page.getByRole("dialog", { name: "Make subtask standalone?" });
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(dialog.getByRole("combobox", { name: "Destination column" })).toHaveValue("Done");
  await dialog.getByRole("combobox", { name: "Destination column" }).selectOption("To Do");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Make standalone task" })).toBeFocused();
  await expect(page.getByRole("button", { name: /Open parent story/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("Done");
  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog", { name: "Make subtask standalone?" });
  await dialog.getByRole("combobox", { name: "Destination column" }).selectOption("To Do");
  await dialog.getByRole("button", { name: "Make standalone task" }).click();
  await expect(page.getByRole("heading", { name: "Define health response format" })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
  await expect(page.getByRole("button", { name: /Open parent story/ })).toHaveCount(0);
  await expect(action).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole("button", { name: "Close issue details" }).click();
  await expect(page.getByRole("searchbox", { name: "Search issues" })).toBeFocused();
  await expect(page.getByRole("region", { name: "To Do issues" }).getByRole("button", { name: /^DEMO-1009/ })).toBeVisible();
});

test("confirms a card drop before converting and linking issues", async ({ page }) => {
  await page.goto("/");
  const source = page.getByRole("button", { name: /^DEMO-1006/ });
  const target = page.getByRole("button", { name: /^DEMO-1007/ });
  await dragIssueOntoIssue(page, source, target);
  let dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(dialog.getByRole("combobox", { name: "Parent issue" })).toHaveValue("DEMO-1007");
  await expect(dialog.getByRole("status")).toContainText("DEMO-1006 will become a Task subtask");
  await expect(dialog.getByRole("status")).toContainText("DEMO-1007 will become a Story");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("region", { name: "Done issues" }).getByRole("button", { name: /^DEMO-1006/ })).toBeVisible();
  await expect(target).toContainText("Task");

  await dragIssueOntoIssue(page, source, target);
  dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await dialog.getByRole("button", { name: "Make subtask" }).click();
  await expect(page.getByRole("status")).toHaveText("Issue DEMO-1006 is now a subtask of DEMO-1007.");
  await expect(page.getByRole("button", { name: /^DEMO-1006/ })).toHaveCount(0);
  await expect(target).toContainText("Story");
  await page.getByRole("button", { name: "Subtasks for DEMO-1007" }).click();
  await page.getByRole("button", {
    name: "Open subtask DEMO-1006: Fix empty workflow state on restart (Done)",
  }).click();
  const breadcrumb = page.getByRole("navigation", { name: "Issue breadcrumb" });
  await expect(breadcrumb).toContainText("Demo Project / DEMO-1007 / DEMO-1006");
  await breadcrumb.getByRole("button", { name: /Open parent story DEMO-1007/ }).click();
  await expect(page.getByRole("heading", { name: "Prepare agent workspace isolation" })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Change issue status" })).toHaveValue("To Do");
});

test("links to an existing Story without dragging, using keyboard-accessible controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1002/ }).click();
  const action = page.getByRole("button", { name: "Make subtask" });
  await action.focus();
  await page.keyboard.press("Enter");
  let dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  const parent = dialog.getByRole("combobox", { name: "Parent issue" });
  await expect(parent).toBeFocused();
  await parent.selectOption("DEMO-1001");
  await expect(dialog.getByRole("status")).not.toContainText("will become a Story");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Make subtask" })).toBeFocused();

  await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog", { name: "Make issue a subtask?" });
  await dialog.getByRole("combobox", { name: "Parent issue" }).selectOption("DEMO-1001");
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Make subtask" })).toBeFocused();
  await page.keyboard.press("Enter");
  const breadcrumb = page.getByRole("navigation", { name: "Issue breadcrumb" });
  await breadcrumb.getByRole("button", { name: /Open parent story DEMO-1001/ }).click();
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1002/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1008/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open subtask DEMO-1009/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
