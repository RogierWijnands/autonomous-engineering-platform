import { expect, test } from "./fixtures";

test("reports invalid dynamic issue data and allows a safe retry", async ({
  page,
}) => {
  await page.addInitScript(() => Reflect.set(window, "__formInjected", 0));
  await page.route(
    "**/api/state",
    async (route) => {
      const response = await route.fetch();
      const state = await response.json();
      state.issues[0].summary = {
        type: "script",
        text: "globalThis.__formInjected=1",
      };
      await route.fulfill({ response, json: state });
    },
    { times: 1 },
  );
  await page.goto("/");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Invalid simulator data");
  await expect(
    page.locator("script").filter({ hasText: "globalThis.__formInjected=1" }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__formInjected"))).toBe(
    0,
  );
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Project" }),
  ).toBeVisible();
});

test("warns when a saved issue receives an invalid response", async ({
  page,
}) => {
  await page.goto("/");
  await page.route(
    "**/api/issues/create",
    async (route) => {
      const response = await route.fetch();
      const result = await response.json();
      delete result.issue;
      await route.fulfill({ response, json: result });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Create issue", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Create an issue" });
  await form.getByLabel("Summary").fill("Saved before invalid response");
  await form.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText(
    "Changes may have been saved",
  );
  await expect(form.getByLabel("Summary")).toHaveValue(
    "Saved before invalid response",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Saved before invalid response/ }),
  ).toBeVisible();
});

test("shows labels in Details and Evidence after acceptance criteria on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Edit issue" }).click();
  const edit = page.getByRole("dialog", { name: "Edit issue" });
  const longLabel = "long-label".repeat(20);
  await edit
    .getByRole("textbox", { name: /Labels/ })
    .fill(`backend, ${longLabel}`);
  await edit.getByRole("button", { name: "Save changes" }).click();

  const criteria = detail.getByRole("heading", {
    name: /^Acceptance criteria/,
  });
  const nextSection = criteria
    .locator("..")
    .locator("xpath=following-sibling::*[1]");
  await expect(
    nextSection.getByRole("heading", { name: "Evidence" }),
  ).toBeVisible();
  const details = detail.getByRole("region", { name: "Details" });
  const labels = details.getByRole("list", { name: "Labels" });
  await expect(labels.getByRole("listitem")).toHaveCount(2);
  await expect(labels).toContainText(longLabel);
  expect(
    await details.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await labels.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await labels
      .getByRole("listitem")
      .last()
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  const editEvidence = detail.getByRole("button", { name: "Add evidence" });
  await editEvidence.focus();
  await page.keyboard.press("Enter");
  await expect(
    detail.getByRole("textbox", { name: "Evidence editor" }),
  ).toBeVisible();
  await detail.getByRole("button", { name: "Cancel" }).click();
  await expect(editEvidence).toBeFocused();
});

test("creates issues in the selected column and keeps the main action default", async ({
  page,
}) => {
  await page.goto("/");
  for (const status of ["To Do", "In Progress", "Done"]) {
    const trigger = page.getByRole("button", {
      name: `Create issue in ${status}`,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Create an issue" });
    const summary = `Created in ${status}`;
    await expect(
      dialog.getByText(`Project: Demo Project · Status: ${status}`),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Summary" }),
    ).toBeFocused();
    await dialog.getByRole("textbox", { name: "Summary" }).fill(summary);
    await dialog
      .getByRole("button", { name: "Create issue", exact: true })
      .click();
    const detail = page.getByRole("dialog", { name: summary });
    await expect(
      detail.getByRole("combobox", { name: "Change issue status" }),
    ).toHaveValue(status);
    await detail.getByRole("button", { name: "Close issue details" }).click();
    await expect(
      page
        .getByRole("region", { name: `${status} issues` })
        .getByRole("button", { name: new RegExp(summary) }),
    ).toBeVisible();
  }
  await page.reload();
  for (const status of ["To Do", "In Progress", "Done"]) {
    await expect(
      page
        .getByRole("region", { name: `${status} issues` })
        .getByRole("button", { name: new RegExp(`Created in ${status}`) }),
    ).toBeVisible();
  }
  const trigger = page.getByRole("button", { name: "Create issue in Done" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Create issue", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Create an issue" })
      .getByText("Project: Demo Project · Status: To Do"),
  ).toBeVisible();
});

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
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close issue details" }).click();
  await page.getByRole("button", { name: "Create issue in Done" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create an issue" });
  await expect(createDialog).toHaveAccessibleDescription(
    "Project: Demo Project · Status: Done",
  );
  await expect(
    createDialog.getByRole("textbox", { name: "Summary" }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
