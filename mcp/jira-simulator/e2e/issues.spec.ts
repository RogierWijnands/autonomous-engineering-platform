import { expect, test } from "./fixtures";

test("creates an issue with safe text and moves it using the status control", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create issue", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Create an issue" });
  const summary = '<img src=x onerror="alert(1)"> validation';

  await dialog.getByRole("textbox", { name: "Summary" }).fill(summary);
  await dialog
    .getByRole("combobox", { name: "Issue type" })
    .selectOption("Bug");
  await dialog
    .getByRole("combobox", { name: "Priority" })
    .selectOption("Highest");
  await dialog
    .getByRole("textbox", { name: /Acceptance criteria/ })
    .fill("Reject invalid input");
  await dialog
    .getByRole("button", { name: "Create issue", exact: true })
    .click();

  const detail = page.getByRole("dialog", { name: summary });

  await expect(detail.getByRole("heading", { name: summary })).toBeVisible();
  await expect(detail.getByText("Reject invalid input")).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  await detail
    .getByRole("combobox", { name: "Change issue status" })
    .selectOption("Done");

  await expect(page.getByRole("status")).toHaveText(
    "Issue DEMO-1010 moved to Done.",
  );

  await detail.getByRole("button", { name: "Close issue details" }).click();

  await expect(
    page
      .getByRole("region", { name: "Done issues" })
      .getByRole("button", { name: /DEMO-1010/ }),
  ).toBeVisible();
});

test("keeps keyboard focus in a dialog and restores it on Escape", async ({
  page,
}) => {
  await page.goto("/");

  const trigger = page.getByRole("button", {
    name: "Create issue",
    exact: true,
  });

  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Create an issue" });

  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.getByRole("textbox", { name: "Summary" })).toBeFocused();

  await dialog
    .getByRole("button", { name: "Create issue", exact: true })
    .focus();
  await page.keyboard.press("Tab");

  await expect(
    dialog.getByRole("button", { name: "Close create issue form" }),
  ).toBeFocused();

  await page.keyboard.press("Shift+Tab");

  await expect(
    dialog.getByRole("button", { name: "Create issue", exact: true }),
  ).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("edits all creation fields and restores focus after cancelling", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1002/ }).click();
  await page.getByRole("button", { name: "Edit issue" }).click();

  let dialog = page.getByRole("dialog", { name: "Edit issue" });
  const summary = dialog.getByRole("textbox", { name: "Summary" });

  await expect(summary).toBeFocused();

  await summary.fill("Discarded edit");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Edit issue" })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Validate incoming request payloads" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit issue" }).click();
  dialog = page.getByRole("dialog", { name: "Edit issue" });

  const unsafeText = '<img src=x onerror="alert(1)"> edited';

  await dialog.getByRole("textbox", { name: "Summary" }).fill(unsafeText);
  await dialog
    .getByRole("textbox", { name: "Description" })
    .fill("Updated description");
  await dialog
    .getByRole("combobox", { name: "Issue type" })
    .selectOption("Bug");
  await dialog.getByRole("combobox", { name: "Priority" }).selectOption("Low");
  await dialog
    .getByRole("textbox", { name: /Labels/ })
    .fill("updated, example");
  await dialog
    .getByRole("textbox", { name: /Acceptance criteria/ })
    .fill("One\nTwo");
  await dialog.getByRole("button", { name: "Save changes" }).click();

  const detail = page.getByRole("dialog", { name: unsafeText });

  await expect(detail.getByText("Updated description")).toBeVisible();
  await expect(detail.getByText("One", { exact: true })).toBeVisible();
  await expect(detail.getByText("Two", { exact: true })).toBeVisible();
  await expect(
    detail.getByRole("combobox", { name: "Change issue status" }),
  ).toHaveValue("To Do");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(
    detail.getByRole("button", { name: "Edit issue" }),
  ).toBeFocused();

  await detail.getByRole("button", { name: "Close issue details" }).click();

  await expect(page.getByRole("button", { name: /^DEMO-1002/ })).toContainText(
    "Bug",
  );
  await expect(page.getByRole("button", { name: /^DEMO-1002/ })).toContainText(
    "Low",
  );
});

test("keeps issue actions and edit form usable at a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();

  const actionsFit = await page
    .locator(".detail-actions")
    .evaluate((element) => element.scrollWidth <= element.clientWidth);

  expect(actionsFit).toBe(true);

  await page.getByRole("button", { name: "Edit issue" }).click();

  const dialog = page.getByRole("dialog", { name: "Edit issue" });

  await dialog.getByLabel("Issue type").selectOption("Bug");

  await expect(dialog.getByRole("status")).toContainText("detach the subtasks");
  await expect(
    dialog.getByRole("button", { name: "Save changes" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
