import { expect, test } from "./fixtures";

test("confirms Story deletion, supports cancellation and retry, and persists the result", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await page.getByRole("button", { name: "Delete issue" }).click();

  let dialog = page.getByRole("dialog", { name: "Delete issue?" });

  await expect(dialog).toHaveAccessibleDescription(
    /also delete 2 subtasks.*cannot be undone/,
  );
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(
    page.getByRole("button", { name: "Delete issue" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Delete issue" }).click();
  dialog = page.getByRole("dialog", { name: "Delete issue?" });

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(
    "**/api/issues/delete",
    async (route) => {
      await gate;
      await route.fulfill({ status: 500, json: { error: "Delete failed." } });
    },
    { times: 1 },
  );
  await dialog.getByRole("button", { name: "Delete issue" }).click();

  await expect(page.getByText("Loading, please wait...")).toBeVisible();

  release();

  await expect(dialog.getByRole("alert")).toHaveText("Delete failed.");

  await dialog.getByRole("button", { name: "Delete issue" }).click();

  await expect(
    page.getByRole("searchbox", { name: "Search issues" }),
  ).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("Issue DEMO-1001 deleted.");

  await page.reload();

  await expect(page.getByRole("button", { name: /^DEMO-1001/ })).toHaveCount(0);

  await page.getByRole("button", { name: "List", exact: true }).click();

  await expect(
    page.getByRole("button", { name: /Open issue DEMO-1008/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Open issue DEMO-1009/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Open issue DEMO-1002/ }),
  ).toBeVisible();
});

test("deletes a project and switches to the remaining project, then shows the empty state", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/projects/create", {
    data: { name: "Other Project", repository: "owner/repo" },
  });
  const { project } = await created.json();
  const issue = await request.post("/api/issues/create", {
    data: {
      projectId: project.id,
      draft: {
        summary: "Keep me",
        description: "",
        issueType: "Task",
        priority: "Medium",
        labels: [],
        acceptanceCriteria: [],
      },
    },
  });

  expect(issue.ok()).toBeTruthy();

  await page.goto("/");
  await page.getByRole("button", { name: "Edit project" }).click();
  await page.getByRole("button", { name: "Delete project" }).click();

  let dialog = page.getByRole("dialog", { name: "Delete project?" });

  await expect(dialog).toHaveAccessibleDescription(
    /Demo Project.*also delete 9 issues.*cannot be undone/,
  );

  await dialog.getByRole("button", { name: "Delete project" }).click();

  await expect(
    page.getByRole("heading", { name: "Other Project" }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: /Keep me/ })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: /Keep me/ })).toBeVisible();

  await page.getByRole("button", { name: "Edit project" }).click();
  await page.getByRole("button", { name: "Delete project" }).click();
  dialog = page.getByRole("dialog", { name: "Delete project?" });

  await expect(dialog).toHaveAccessibleDescription(/also delete 1 issue/);

  await dialog.getByRole("button", { name: "Delete project" }).click();

  await expect(
    page.getByRole("heading", { name: "No projects yet" }),
  ).toBeFocused();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "No projects yet" }),
  ).toBeVisible();
});

test("rejects stale and cross-origin deletion requests without deleting data", async ({
  request,
}) => {
  const stale = await request.post("/api/issues/delete", {
    data: { key: "DEMO-1001", subtaskKeys: [] },
  });

  expect(stale.status()).toBe(409);

  const forged = await request.post("/api/projects/delete", {
    headers: { Origin: "https://example.invalid" },
    data: { id: "project-demo", issueKeys: [] },
  });

  expect(forged.status()).toBe(403);

  const state = await request.get("/api/state");

  expect((await state.json()).issues).toHaveLength(9);
});
