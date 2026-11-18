import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

test("dashboard authenticates, renders untrusted data as text and disconnects", async ({
  page,
}) => {
  const root = new URL("../../../aep/src/Aep/wwwroot/", import.meta.url);
  let requests = 0;
  await page.route("http://127.0.0.1:60606/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/workflows") {
      requests++;
      if (
        route.request().headers().authorization !==
        "Bearer synthetic-test-token"
      ) {
        await route.fulfill({ status: 401 });
        return;
      }
      await route.fulfill({
        json: [
          {
            issueKey: "DEMO-1",
            summary: "<script>alert(1)</script>",
            repository: "owner/repo",
            status: "Received",
            steps: [{ name: "Analyst", status: "Pending" }],
            events: [
              {
                occurredAt: "2025-01-01T00:00:00Z",
                eventType: "workflow.queued",
              },
              ...(requests >= 3
                ? [
                    {
                      occurredAt: "2025-01-01T00:00:03Z",
                      eventType: "workflow.updated",
                    },
                  ]
                : []),
            ],
          },
        ],
      });
      return;
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (!["index.html", "dashboard.css", "dashboard.js"].includes(file))
      throw new Error(`Unexpected dashboard resource: ${file}`);
    await route.fulfill({ path: fileURLToPath(new URL(file, root)) });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("http://127.0.0.1:60606/");
  await page.getByLabel("Dashboard token").fill("wrong");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("status")).toContainText("Authentication failed");
  await page.getByLabel("Dashboard token").fill("synthetic-test-token");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("status")).toContainText("Connected");
  await expect(
    page.getByRole("heading", { name: "Queued", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Analyst: Pending")).toBeVisible();
  await expect(
    page.getByText("<script>alert(1)</script>", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("article script")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await expect
    .poll(() => requests, { timeout: 6000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page.getByRole("log")).toContainText("workflow.updated");
  await expect(page.getByRole("status")).toContainText("Workflow data updated");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByLabel("Dashboard token")).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("Disconnected.");
});
