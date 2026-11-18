import { expect, test } from "./fixtures";

test("configures project defaults and issue overrides across reloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Edit project" }).click();
  const project = page.getByRole("dialog", { name: "Edit project" });
  const defaultRepository = project.getByRole("textbox", {
    name: "Default GitHub repository",
  });
  await expect(defaultRepository).toHaveAttribute("aria-required", "true");
  await defaultRepository.fill("");
  await project.getByRole("button", { name: "Save changes" }).click();
  await expect(defaultRepository).toBeFocused();
  await expect(defaultRepository).toHaveAttribute("aria-invalid", "true");
  await expect(project.getByRole("alert")).toContainText("required");
  await defaultRepository.fill("owner/unsaved");
  await project.getByRole("button", { name: "Delete project" }).click();
  await page
    .getByRole("dialog", { name: "Delete project?" })
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(defaultRepository).toHaveValue("owner/unsaved");
  await defaultRepository.fill("https://example.com/bad");
  await project.getByRole("button", { name: "Save changes" }).click();
  await expect(defaultRepository).toBeFocused();
  await expect(defaultRepository).toHaveAttribute("aria-invalid", "true");
  await defaultRepository.fill("owner/default");
  await project.getByRole("button", { name: "Save changes" }).click();

  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await expect(page.getByText("owner/default (project default)")).toBeVisible();
  await page.getByRole("button", { name: "Edit issue" }).click();
  const issue = page.getByRole("dialog", { name: "Edit issue" });
  await issue
    .getByRole("textbox", { name: "GitHub repository override" })
    .fill("other/override");
  await issue.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("other/override (issue override)")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  await page.reload();
  await page.getByRole("button", { name: /^DEMO-1001/ }).click();
  await expect(page.getByText("other/override (issue override)")).toBeVisible();
  await page.getByRole("button", { name: "Edit issue" }).click();
  await issue
    .getByRole("textbox", { name: "GitHub repository override" })
    .fill("");
  await issue.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("owner/default (project default)")).toBeVisible();
});
