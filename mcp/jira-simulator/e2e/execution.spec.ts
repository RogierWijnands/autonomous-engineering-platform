import { expect, test } from "./fixtures";
import type { Locator } from "./fixtures";

async function expectMatchingActionHeights(detail: Locator) {
  const heights = await detail
    .locator(
      ".detail-actions > button, .detail-actions > .status-select, .detail-actions > .priority-pill",
    )
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    );
  expect(heights.length).toBeGreaterThanOrEqual(6);
  for (const height of heights) expect(height).toBe(34);
}

for (const width of [320, 1280]) {
  test(`confirms an execution request accessibly at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const requests: string[] = [];
    await page.route("**/api/issues/execute", async (route) => {
      requests.push(route.request().postData() ?? "");
      await route.fulfill({ status: 202, json: { delivered: true } });
    });
    await page.goto("/");
    await page.getByRole("button", { name: /^DEMO-1001/ }).click();
    const detail = page.getByRole("dialog", {
      name: "Add health check endpoint",
    });
    const execute = detail.getByRole("button", {
      name: "Execute",
      exact: true,
    });
    await expectMatchingActionHeights(detail);
    await execute.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Execute issue?" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAccessibleDescription(
      /DEMO-1001.*duplicate work/s,
    );
    await expect(detail).toHaveAttribute("inert", "");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Close execution confirmation" }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Execute issue" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close execution confirmation" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(execute).toBeFocused();
    expect(requests).toHaveLength(0);

    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "Execute issue" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("status")).toContainText(
      "does not confirm that execution has started",
    );
    await expect(dialog.getByRole("button", { name: "Done" })).toBeFocused();
    expect(requests.map((body) => JSON.parse(body))).toEqual([
      { key: "DEMO-1001" },
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(execute).toBeFocused();
    await expect(detail).not.toHaveAttribute("inert", "");
    await detail
      .getByRole("button", { name: /Open subtask DEMO-1008/ })
      .click();
    const subtask = page.getByRole("dialog", {
      name: "Implement dependency health checks",
    });
    await expect(
      subtask.getByRole("button", { name: "Make standalone task" }),
    ).toBeVisible();
    await expectMatchingActionHeights(subtask);
  });
}

test("shows an uncertain outcome instead of silently retrying", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/issues/execute", async (route) => {
    count++;
    await route.fulfill({
      status: 502,
      json: {
        error:
          "AEP did not confirm receipt. Execution may have started; check AEP before trying again.",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Execute issue?" });
  await dialog.getByRole("button", { name: "Execute issue" }).click();
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(dialog.getByRole("alert")).toContainText(
    "check AEP before trying again",
  );
  expect(count).toBe(1);
});
