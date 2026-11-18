import { expect, test as base } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { initialProjects } from "../src/test/fixtures/projects";
import { initialIssues } from "../src/test/fixtures/issues";

export async function resetDatabase(request: APIRequestContext) {
  const response = await request.post("/api/test/reset", {
    data: { projects: initialProjects, issues: initialIssues },
  });

  expect(response.ok()).toBeTruthy();
}

const test = base.extend<{ resetDatabase: void }>({
  resetDatabase: [
    async ({ request }, use) => {
      await resetDatabase(request);
      await use();
    },
    { auto: true },
  ],
});

export { expect, test };
export type { Locator, Page } from "@playwright/test";
