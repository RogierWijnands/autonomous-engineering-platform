import { expect, test } from "./fixtures";
import type { Locator } from "./fixtures";

async function expectEmptyEvidenceGap(detail: Locator) {
  const textBox = await detail.getByText("No evidence added.").boundingBox();
  const buttonBox = await detail
    .getByRole("button", { name: "Add evidence" })
    .boundingBox();
  if (!textBox || !buttonBox)
    throw new Error("Evidence controls are not visible.");
  expect(buttonBox.y - (textBox.y + textBox.height)).toBeGreaterThanOrEqual(8);
}

test("shows Add evidence after clearing saved text with Backspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Add evidence" }).click();
  const editor = detail.getByRole("textbox", { name: "Evidence editor" });
  await editor.fill("Verification passed");
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await detail.getByRole("button", { name: "Edit evidence" }).click();
  await editor.press("ControlOrMeta+A");
  await editor.press("Backspace");
  await detail.getByRole("button", { name: "Cancel" }).click();
  await expect(
    detail.getByRole("button", { name: "Edit evidence" }),
  ).toBeFocused();
  await expect(detail.locator(".evidence-content")).toHaveText(
    "Verification passed",
  );
  await detail.getByRole("button", { name: "Edit evidence" }).click();
  await editor.press("ControlOrMeta+A");
  await editor.press("Backspace");
  await detail.getByRole("button", { name: "Save evidence" }).click();
  const add = detail.getByRole("button", { name: "Add evidence" });
  await expect(add).toBeFocused();
  await expect(detail.getByText("No evidence added.")).toBeVisible();
  await expectEmptyEvidenceGap(detail);

  await add.click();
  await editor.fill("   ");
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await expect(add).toBeFocused();
  await expect(detail.getByText("No evidence added.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  await page.reload();
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await expect(
    page.getByRole("button", { name: "Add evidence" }),
  ).toBeVisible();
  await expect(page.getByText("No evidence added.")).toBeVisible();
});

test("keeps stored form and evidence markup as inert text after reload", async ({
  page,
}) => {
  const text = '<img src=x onerror="globalThis.__injection=1">';
  await page.addInitScript(() => {
    Reflect.set(window, "__injection", 0);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create issue", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Create an issue" });
  await form.getByLabel("Summary").fill(text);
  await form.getByLabel("Description").fill(text);
  await form.getByLabel(/Labels/).fill(text);
  await form.getByLabel(/Acceptance criteria/).fill(text);
  await form.getByRole("button", { name: "Create issue", exact: true }).click();
  const detail = page.getByRole("dialog", { name: text });
  await expect(detail.getByRole("heading", { name: text })).toBeVisible();
  const key = await detail.locator(".detail-key").textContent();
  expect(key).toMatch(/^DEMO-\d+$/);
  await expect(detail.getByLabel("Labels")).toContainText(text);
  await expect(detail.locator(".detail-description")).toHaveText(text);
  await expect(detail.locator(".criteria-list")).toContainText(text);
  await detail.getByRole("button", { name: "Add evidence" }).click();
  await detail.getByRole("textbox", { name: "Evidence editor" }).fill(text);
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await expect(detail.locator(".evidence-content")).toHaveText(text);
  await detail.getByRole("button", { name: "Edit evidence" }).click();
  await expect(
    detail.getByRole("textbox", { name: "Evidence editor" }),
  ).toHaveText(text);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__injection"))).toBe(0);

  await page.reload();
  await page.getByRole("button", { name: new RegExp(`^${key}`) }).click();
  await expect(page.locator(".evidence-content")).toHaveText(text);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__injection"))).toBe(0);
});

test("rejects unsafe evidence from a dynamic response before loading images", async ({
  page,
}) => {
  let imageRequests = 0;
  await page.route("http://127.0.0.1:9/**", (route) => {
    imageRequests++;
    return route.abort();
  });
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    state.issues[0].evidence = {
      type: "doc",
      content: [{ type: "image", attrs: { src: "http://127.0.0.1:9/image" } }],
    };
    await route.fulfill({ response, json: state });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await expect(detail.getByRole("alert")).toContainText(
    "Evidence could not be displayed",
  );
  await expect(
    detail.getByRole("button", { name: "Edit evidence" }),
  ).toHaveCount(0);
  await expect(detail.locator("img")).toHaveCount(0);
  expect(imageRequests).toBe(0);
});

test("saves and updates evidence with a large local image through the UI", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  const addEvidence = detail.getByRole("button", { name: "Add evidence" });
  await expectEmptyEvidenceGap(detail);
  await addEvidence.click();
  const editor = detail.getByRole("textbox", { name: "Evidence editor" });
  await editor.fill("Large image evidence");
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 350;
    canvas.height = 350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable.");
    const image = context.createImageData(canvas.width, canvas.height);
    let value = 123456;
    for (let index = 0; index < image.data.length; index += 4) {
      for (let channel = 0; channel < 3; channel++) {
        value = (value * 1664525 + 1013904223) >>> 0;
        image.data[index + channel] = value >>> 24;
      }
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  expect(buffer.length).toBeGreaterThan(100_000);
  expect(buffer.length).toBeLessThanOrEqual(512_000);
  await detail.getByRole("button", { name: "Insert Image" }).click();
  const dialog = page.getByRole("dialog", { name: "Insert Image" });
  await dialog.getByLabel("Image file").setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer,
  });
  await dialog
    .getByRole("button", { name: "Insert Image", exact: true })
    .click();
  await expect(
    editor.getByRole("img", { name: "Evidence image" }),
  ).toBeVisible();
  await page.route(
    "**/api/issues/evidence",
    (route) => route.fulfill({ status: 404, json: { error: "Not found." } }),
    { times: 1 },
  );
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await expect(detail.getByRole("alert")).toContainText(
    "API endpoint not found. Check that the simulator API is current",
  );
  await expect(editor).toContainText("Large image evidence");
  await expect(
    editor.getByRole("img", { name: "Evidence image" }),
  ).toBeVisible();
  const firstSave = page.waitForResponse((response) =>
    response.url().endsWith("/api/issues/evidence"),
  );
  await detail.getByRole("button", { name: "Save evidence" }).click();
  expect((await firstSave).status()).toBe(200);
  await detail.getByRole("button", { name: "Edit evidence" }).click();
  const secondSave = page.waitForResponse((response) =>
    response.url().endsWith("/api/issues/evidence"),
  );
  await detail.getByRole("button", { name: "Save evidence" }).click();
  expect((await secondSave).status()).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await expect(page.getByRole("img", { name: "Evidence image" })).toBeVisible();
  await expect(page.getByText("Large image evidence")).toBeVisible();
});

test("tab-focuses images and removes only the chosen ones with Backspace and Delete", async ({
  page,
  request,
}) => {
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    return canvas.toDataURL("image/png");
  });
  const response = await request.post("/api/issues/evidence", {
    data: {
      key: "DEMO-1001",
      expected: null,
      evidence: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Keep text" }] },
          { type: "image", attrs: { src, alt: "First image" } },
          { type: "image", attrs: { src, alt: "Second image" } },
          { type: "image", attrs: { src, alt: "Third image" } },
        ],
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Edit evidence" }).click();
  const editor = detail.getByRole("textbox", { name: "Evidence editor" });
  const first = editor.getByRole("img", { name: "First image" });
  const second = editor.getByRole("img", { name: "Second image" });
  const third = editor.getByRole("img", { name: "Third image" });

  await expect(editor).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await expect(first).toHaveAccessibleDescription(
    "Delete or Backspace removes the selected image.",
  );
  await expect(first).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(second).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(second).toHaveCount(0);
  await expect(editor).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(third).toBeFocused();
  await page.keyboard.press("Delete");
  await expect(third).toHaveCount(0);
  await expect(editor).toBeFocused();
  await expect(first).toBeVisible();
  await expect(editor).toContainText("Keep text");

  await detail.getByRole("button", { name: "Save evidence" }).click();
  await page.reload();
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await expect(page.getByRole("img", { name: "First image" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Second image" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Third image" })).toHaveCount(0);
  await expect(page.getByText("Keep text")).toBeVisible();
  await page.getByRole("button", { name: "Edit evidence" }).click();
  await first.click();
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Backspace");
  await expect(first).toHaveCount(0);
  await detail.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("img", { name: "First image" })).toBeVisible();
});

test("edits and persists formatted evidence with an accessible image", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await expectEmptyEvidenceGap(detail);
  await detail.getByRole("button", { name: "Add evidence" }).click();
  const editor = detail.getByRole("textbox", { name: "Evidence editor" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(detail.getByRole("button", { name: "Cancel" })).toBeFocused();
  await editor.focus();
  await editor.fill("Automated tests passed");
  await editor.press("ControlOrMeta+A");
  await detail.getByRole("button", { name: "Bold" }).click();
  await detail.getByRole("button", { name: "Insert Image" }).click();
  const imageDialog = page.getByRole("dialog", { name: "Insert Image" });
  await expect(imageDialog.getByLabel("Image file")).toBeFocused();
  await imageDialog.getByLabel("Image file").setInputFiles({
    name: "result.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  await imageDialog
    .getByLabel("Image description")
    .fill("Test results screenshot");
  await imageDialog
    .getByRole("button", { name: "Insert Image", exact: true })
    .click();
  await expect(imageDialog).toBeHidden();
  await expect(
    editor.getByRole("img", { name: "Test results screenshot" }),
  ).toBeVisible();
  await expect(page.locator(".detail-panel")).not.toHaveAttribute("inert", "");
  await expect(editor).toBeFocused();
  await expect(
    editor.getByRole("img", { name: "Test results screenshot" }),
  ).toHaveJSProperty("naturalWidth", 1);
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await expect(
    detail.getByRole("button", { name: "Edit evidence" }),
  ).toBeFocused();
  await expect(detail.getByText("Automated tests passed")).toBeVisible();
  await expect(
    detail.locator("strong", { hasText: "Automated tests passed" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("img", { name: "Test results screenshot" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  await page.reload();
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await expect(page.getByText("Automated tests passed")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Test results screenshot" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Add an endpoint that reports application and dependency health for local development.",
    ),
  ).toBeVisible();
});

test("Escape cancels evidence editing without closing issue details", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Add evidence" }).click();
  await detail
    .getByRole("textbox", { name: "Evidence editor" })
    .fill("Discard this");
  await page.keyboard.press("Escape");
  await expect(
    detail.getByRole("button", { name: "Add evidence" }),
  ).toBeFocused();
  await expect(detail.getByText("No evidence added.")).toBeVisible();
});

test("the image dialog traps focus and returns to the intact evidence draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Add evidence" }).click();
  await detail
    .getByRole("textbox", { name: "Evidence editor" })
    .fill("Keep this draft");
  await detail.getByRole("button", { name: "Insert Image" }).click();

  const dialog = page.getByRole("dialog", { name: "Insert Image" });
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.locator("label > span")).toHaveText([
    "Image file",
    "Image description (optional)",
  ]);
  await expect(dialog.getByLabel("Image file")).toBeFocused();
  await expect(page.locator(".detail-panel")).toHaveAttribute("inert", "");
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Close insert image dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Insert Image", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close insert image dialog" }),
  ).toBeFocused();
  await dialog.getByLabel("Image description").fill("Unsaved description");
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(
    detail.getByRole("button", { name: "Insert Image" }),
  ).toBeFocused();
  await expect(page.locator(".detail-panel")).not.toHaveAttribute("inert", "");
  await expect(
    detail.getByRole("textbox", { name: "Evidence editor" }),
  ).toContainText("Keep this draft");
  await detail.getByRole("button", { name: "Insert Image" }).click();
  await expect(dialog.getByLabel("Image description")).toHaveValue("");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(
    detail.getByRole("button", { name: "Insert Image" }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});

test("keeps an evidence draft when another client saves first", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Add evidence" }).click();
  const editor = detail.getByRole("textbox", { name: "Evidence editor" });
  await editor.fill("My unsaved evidence");
  const response = await request.post("/api/issues/evidence", {
    data: {
      key: "DEMO-1001",
      expected: null,
      evidence: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Other evidence" }],
          },
        ],
      },
    },
  });
  expect(response.status()).toBe(200);
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await expect(detail.getByRole("alert")).toContainText("Evidence has changed");
  await expect(editor).toContainText("My unsaved evidence");
  const issue = await request.get("/api/issues/DEMO-1001");
  expect(JSON.stringify(await issue.json())).toContain("Other evidence");
});

test("supports lists and static JPEG and WebP evidence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  const detail = page.getByRole("dialog", {
    name: "Add health check endpoint",
  });
  await detail.getByRole("button", { name: "Add evidence" }).click();
  const editor = detail.getByRole("textbox", { name: "Evidence editor" });
  await editor.fill("Verification checklist");
  await editor.press("ControlOrMeta+A");
  await detail.getByRole("button", { name: "Bullets" }).click();

  for (const [mime, label] of [
    ["image/jpeg", "JPEG result"],
    ["image/webp", "WebP result"],
  ] as const) {
    const dataUrl = await page.evaluate((type) => {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable.");
      context.fillRect(0, 0, 2, 2);
      return canvas.toDataURL(type);
    }, mime);
    expect(dataUrl).toContain(`data:${mime};base64,`);
    await detail.getByRole("button", { name: "Insert Image" }).click();
    const imageDialog = page.getByRole("dialog", { name: "Insert Image" });
    await imageDialog.getByLabel("Image file").setInputFiles({
      name: mime === "image/jpeg" ? "result.jpg" : "result.webp",
      mimeType: mime,
      buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
    });
    await imageDialog.getByLabel("Image description").fill(label);
    await imageDialog
      .getByRole("button", { name: "Insert Image", exact: true })
      .click();
    await expect(editor.getByRole("img", { name: label })).toBeVisible();
    await expect(editor.getByRole("img", { name: label })).toHaveJSProperty(
      "naturalWidth",
      2,
    );
  }
  await detail.getByRole("button", { name: "Save evidence" }).click();
  await expect(
    detail.locator("ul li", { hasText: "Verification checklist" }),
  ).toBeVisible();
  await expect(detail.getByRole("img", { name: "JPEG result" })).toBeVisible();
  await expect(detail.getByRole("img", { name: "WebP result" })).toBeVisible();
});
