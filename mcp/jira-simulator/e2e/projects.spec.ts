import { expect, test } from "./fixtures";

test("validates project prefixes and keeps issues in their own project", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create project" }).click();

  const projectDialog = page.getByRole("dialog", { name: "Create project" });
  const name = projectDialog.getByRole("textbox", { name: "Project name" });

  await name.fill("Demo Other");
  await projectDialog.getByRole("button", { name: "Create project" }).click();

  await expect(projectDialog.getByRole("alert")).toContainText("prefix DEMO");

  await name.fill("Alpha Project");
  await projectDialog
    .getByLabel("Default GitHub repository")
    .fill("owner/repo");
  await projectDialog.getByRole("button", { name: "Create project" }).click();

  await expect(
    page.getByRole("heading", { name: "Alpha Project" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /DEMO-1001/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Create issue", exact: true }).click();

  const issueDialog = page.getByRole("dialog", { name: "Create an issue" });

  await issueDialog
    .getByRole("textbox", { name: "Summary" })
    .fill("Alpha issue");
  await issueDialog
    .getByRole("button", { name: "Create issue", exact: true })
    .click();

  await expect(page.getByRole("dialog", { name: "Alpha issue" })).toBeVisible();

  await page.getByRole("button", { name: "Close issue details" }).click();

  await expect(page.getByRole("button", { name: /ALPHA-1001/ })).toBeVisible();

  await page.getByRole("button", { name: "Edit project" }).click();

  const editDialog = page.getByRole("dialog", { name: "Edit project" });

  await editDialog
    .getByRole("textbox", { name: "Project name" })
    .fill("Beta Project");
  await editDialog.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("button", { name: /BETA-1001/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /ALPHA-1001/ })).toHaveCount(0);

  await page
    .getByRole("button", { name: "Select Demo Project project" })
    .click();

  await expect(page.getByRole("button", { name: /^DEMO-1001/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /BETA-1001/ })).toHaveCount(0);
});
