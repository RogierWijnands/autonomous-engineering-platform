import { expect, test } from "./fixtures";

test("starts empty and creates the first project with the keyboard", async ({
  page,
  request,
}) => {
  const reset = await request.post("/api/test/reset", {
    data: { projects: [], issues: [] },
  });

  expect(reset.ok()).toBeTruthy();

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "No projects yet" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  const create = page.getByRole("button", {
    name: "Create your first project",
  });

  await create.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Create project" });

  await expect(dialog.getByLabel("Project name")).toBeFocused();

  await dialog.getByLabel("Project name").fill("Alpha Project");
  await page.route(
    "**/api/projects/create",
    (route) => route.fulfill({ status: 500, json: { error: "Save failed." } }),
    { times: 1 },
  );
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Save failed.");
  await expect(dialog.getByLabel("Project name")).toHaveValue("Alpha Project");

  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(
    page.getByRole("heading", { name: "Alpha Project" }),
  ).toBeFocused();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Alpha Project" }),
  ).toBeVisible();
  await expect(page.getByText("No projects yet")).toHaveCount(0);
});

test("announces loading, retains failed input, and persists successful changes", async ({
  page,
}) => {
  let releaseLoad!: () => void;
  const loadGate = new Promise<void>((resolve) => {
    releaseLoad = resolve;
  });

  await page.route("**/api/state", async (route) => {
    await loadGate;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("status")).toHaveText(
    "Loading simulator data...",
  );

  releaseLoad();

  await expect(
    page.getByRole("heading", { name: "Demo Project" }),
  ).toBeVisible();

  await page.unroute("**/api/state");

  await page.getByRole("button", { name: "Create issue", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Create an issue" });

  await dialog.getByLabel("Summary").fill("Persistent issue");

  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });

  await page.route(
    "**/api/issues/create",
    async (route) => {
      await saveGate;
      await route.fulfill({ status: 500, json: { error: "Save failed." } });
    },
    { times: 1 },
  );
  await dialog
    .getByRole("button", { name: "Create issue", exact: true })
    .click();

  await expect(page.getByText("Loading, please wait...")).toBeVisible();
  await expect(page.getByText("Loading, please wait...")).toBeFocused();

  await page.keyboard.press("Escape");
  releaseSave();

  await expect(dialog.getByRole("alert")).toHaveText("Save failed.");
  await expect(dialog.getByLabel("Summary")).toHaveValue("Persistent issue");

  await dialog
    .getByRole("button", { name: "Create issue", exact: true })
    .click();

  await expect(
    page.getByRole("dialog", { name: "Persistent issue" }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: /Persistent issue/ }),
  ).toBeVisible();
});

test("rejects cross-origin and malformed writes", async ({ request }) => {
  const forbidden = await request.post("/api/projects/create", {
    headers: { Origin: "https://example.invalid" },
    data: { name: "Injected Project" },
  });

  expect(forbidden.status()).toBe(403);

  const invalid = await request.post("/api/projects/create", {
    headers: { "Content-Type": "text/plain" },
    data: "{}",
  });

  expect(invalid.status()).toBe(415);

  const state = await request.get("/api/state");

  expect((await state.json()).projects).toHaveLength(1);
});
