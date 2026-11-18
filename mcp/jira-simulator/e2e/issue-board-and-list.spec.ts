import { expect, resetDatabase, test } from "./fixtures";

test("filters issues across board and list views and clears filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search issues" }).fill("security");
  await page
    .getByRole("combobox", { name: "Filter by status" })
    .selectOption("To Do");

  await expect(page.getByRole("button", { name: /DEMO-1002/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /DEMO-1007/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /DEMO-1001/ })).toHaveCount(0);

  await page.getByRole("button", { name: "List", exact: true }).click();

  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  const table = page.getByRole("table", { name: "Issues" });

  await expect(table.getByRole("row")).toHaveCount(3);

  await page
    .getByRole("searchbox", { name: "Search issues" })
    .fill("no matching issue");

  await expect(table.getByText("No issues match your search.")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();

  await expect(
    page.getByRole("combobox", { name: "Filter by status" }),
  ).toHaveValue("All");
  await expect(table.getByRole("row")).toHaveCount(10);
});

test("moves an issue by dragging between board columns", async ({ page }) => {
  await page.goto("/");

  const toDo = page.getByRole("region", { name: "To Do issues" });
  const inProgress = page.getByRole("region", { name: "In Progress issues" });

  await toDo
    .getByRole("button", { name: /DEMO-1002/ })
    .dragTo(inProgress, { targetPosition: { x: 5, y: 5 } });

  await expect(
    inProgress.getByRole("button", { name: /DEMO-1002/ }),
  ).toBeVisible();
  await expect(toDo.getByRole("button", { name: /DEMO-1002/ })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText(
    "Issue DEMO-1002 moved to In Progress.",
  );
});

test("provides a clear drop area in other columns while dragging", async ({
  page,
  request,
}) => {
  for (const width of [1200, 320]) {
    await resetDatabase(request);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    const toDo = page.getByRole("region", { name: "To Do issues" });
    const inProgress = page.getByRole("region", { name: "In Progress issues" });
    const source = toDo.getByRole("button", { name: /DEMO-1002/ });
    const area = inProgress.getByText("Drop here to move to In Progress");

    await expect(area).toHaveCount(0);

    await source.scrollIntoViewIfNeeded();

    const sourceBox = await source.boundingBox();

    if (!sourceBox) throw new Error("Source issue is not visible.");

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 15,
      sourceBox.y + sourceBox.height / 2,
      { steps: 5 },
    );

    await expect(area).toBeVisible();
    await expect(toDo.getByText(/Drop here to move/)).toHaveCount(0);
    await expect(area).toHaveAttribute("aria-hidden", "true");

    await area.scrollIntoViewIfNeeded();

    const areaBox = await area.boundingBox();
    const firstCardBox = await inProgress
      .getByRole("button", { name: /^DEMO-1001/ })
      .boundingBox();

    if (!areaBox || !firstCardBox)
      throw new Error("Drop area or target card is not visible.");

    expect(areaBox.height).toBeGreaterThanOrEqual(72);
    expect(areaBox.width).toBeGreaterThanOrEqual(100);
    expect(areaBox.y + areaBox.height).toBeLessThanOrEqual(firstCardBox.y);

    await page.mouse.move(
      areaBox.x + areaBox.width / 2,
      areaBox.y + areaBox.height / 2,
      { steps: 10 },
    );

    await expect(inProgress).toHaveClass(/drag-over/);

    await page.mouse.up();

    await expect(
      inProgress.getByRole("button", { name: /DEMO-1002/ }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(
      "Issue DEMO-1002 moved to In Progress.",
    );
    await expect(page.getByText(/Drop here to move/)).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);

    await inProgress.getByRole("button", { name: /DEMO-1002/ }).click();

    const status = page.getByRole("combobox", { name: "Change issue status" });

    await status.focus();
    await page.keyboard.press("Space");

    expect(await status.evaluate((element) => element.matches(":open"))).toBe(
      true,
    );

    await status.blur();
    await status.selectOption("Done");

    await expect(status).toHaveValue("Done");
  }
});
