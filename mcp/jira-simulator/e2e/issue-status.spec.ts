import { expect, test } from "./fixtures";

test("matches the status control to the edit action and priority at desktop and mobile widths", async ({
  page,
}) => {
  for (const width of [1200, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: /^DEMO-1001/ }).click();

    const dialog = page.getByRole("dialog", {
      name: "Add health check endpoint",
    });
    const edit = dialog.getByRole("button", { name: "Edit issue" });
    const status = dialog.getByRole("combobox", {
      name: "Change issue status",
    });
    const statusContainer = dialog.locator(".status-select");
    const priority = dialog.locator(".detail-actions > .priority-pill");
    const editHeight = (await edit.boundingBox())?.height;

    expect(editHeight).toBeDefined();
    expect((await statusContainer.boundingBox())?.height).toBe(editHeight);
    expect((await priority.boundingBox())?.height).toBe(editHeight);

    const fontSize = await edit.evaluate(
      (element) => getComputedStyle(element).fontSize,
    );

    expect(
      await status.evaluate((element) => getComputedStyle(element).fontSize),
    ).toBe(fontSize);
    expect(
      await priority.evaluate((element) => getComputedStyle(element).fontSize),
    ).toBe(fontSize);

    await status.selectOption("Done");

    await expect(status).toHaveValue("Done");
    expect(
      await dialog
        .locator(".detail-actions")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  }
});

test("opens the status dropdown from its arrow and lower padding", async ({
  page,
}) => {
  for (const width of [1200, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: /^DEMO-1001/ }).click();

    const status = page.getByRole("combobox", { name: "Change issue status" });
    const control = page.locator(".status-select");
    const arrow = control.locator("svg");
    const arrowBox = await arrow.boundingBox();
    const controlBox = await control.boundingBox();

    expect(arrowBox).not.toBeNull();
    expect(controlBox).not.toBeNull();

    if (!arrowBox || !controlBox)
      throw new Error("Status control is not visible.");

    const points = [
      {
        x: arrowBox.x + arrowBox.width / 2,
        y: arrowBox.y + arrowBox.height / 2,
      },
      {
        x: controlBox.x + controlBox.width / 2,
        y: controlBox.y + controlBox.height - 3,
      },
    ];

    for (const point of points) {
      expect(
        await status.evaluate(
          (element, { x, y }) => document.elementFromPoint(x, y) === element,
          point,
        ),
      ).toBe(true);

      await page.mouse.click(point.x, point.y);

      await expect(status).toBeFocused();
      expect(await status.evaluate((element) => element.matches(":open"))).toBe(
        true,
      );

      await page.keyboard.press("Escape");

      await expect(
        page.getByRole("dialog", { name: "Add health check endpoint" }),
      ).toBeVisible();

      await status.blur();

      expect(await status.evaluate((element) => element.matches(":open"))).toBe(
        false,
      );
    }

    await status.selectOption("Done");

    await expect(status).toHaveValue("Done");
  }
});
