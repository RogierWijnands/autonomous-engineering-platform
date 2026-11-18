import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { createStore } from "../database/store.ts";
import { initialIssues } from "../../src/test/fixtures/issues.ts";
import { initialProjects } from "../../src/test/fixtures/projects.ts";

async function setup() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  const store = createStore(":memory:");
  store.resetTestData({ projects: initialProjects, issues: initialIssues });
  const server = createServer(createApp(port, store)).listen(port, "127.0.0.1");
  await once(server, "listening");
  return {
    port,
    store,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      store.close();
    },
  };
}

test("issue creation routes accept valid initial statuses and reject invalid ones", async () => {
  const api = await setup();
  try {
    const draft = {
      summary: "New issue",
      description: "",
      issueType: "Task",
      priority: "Medium",
      labels: [],
      acceptanceCriteria: [],
    };
    const post = (body: object) =>
      fetch(`${api.url}/api/issues/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const payload = { projectId: "project-demo", draft };
    const response = await post({ ...payload, status: "In Progress" });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.issue.status, "In Progress");
    assert.equal(api.store.getIssue(result.issue.key).status, "In Progress");
    const before = api.store.snapshot();
    assert.equal((await post({ ...payload, status: "Blocked" })).status, 400);
    assert.deepEqual(api.store.snapshot(), before);
    const defaultResult = await (await post(payload)).json();
    assert.equal(defaultResult.issue.status, "To Do");
  } finally {
    await api.close();
  }
});

test("issue routes preserve filtering, validation and evidence responses", async () => {
  const api = await setup();
  try {
    const issue = api.store.getIssue("DEMO-1001");
    const result = await fetch(`${api.url}/api/issues`);
    const expected = api.store.snapshot();
    assert.deepEqual(await result.json(), {
      projects: expected.projects,
      issues: expected.issues.map(({ key, projectId, summary, status }) => ({
        key,
        projectId,
        summary,
        status,
      })),
    });
    assert.deepEqual(
      await (await fetch(`${api.url}/api/issues/${issue.key}`)).json(),
      { issue },
    );
    assert.equal((await fetch(`${api.url}/api/issues?projectId=`)).status, 400);
    assert.equal((await fetch(`${api.url}/api/issues/%ZZ`)).status, 400);

    const evidence = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Test passed" }] },
      ],
    };
    const payload = JSON.stringify({
      key: issue.key,
      expected: null,
      evidence,
    });
    const updated = await fetch(
      `${api.url}/api/issues/evidence?response=issue`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      },
    );
    assert.deepEqual(await updated.json(), {
      issue: api.store.getIssue(issue.key),
    });
    assert.deepEqual(api.store.getIssue(issue.key).evidence, evidence);
    const stale = await fetch(`${api.url}/api/issues/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    assert.equal(stale.status, 409);
  } finally {
    await api.close();
  }
});

test("enforces request security, JSON limits and exact routes before dispatch", async () => {
  const api = await setup();
  try {
    const original = api.store.snapshot();
    const headers = { "Content-Type": "application/json" };
    const post = (
      path: string,
      body: string,
      extra: Record<string, string> = {},
    ) =>
      fetch(`${api.url}${path}`, {
        method: "POST",
        headers: { ...headers, ...extra },
        body,
      });
    const deniedHost = await new Promise<number | undefined>(
      (resolve, reject) => {
        const request = httpRequest(
          `${api.url}/api/projects/create`,
          {
            method: "POST",
            headers: { ...headers, Host: `localhost:${api.port}` },
          },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        request.on("error", reject);
        request.end("{}");
      },
    );
    assert.equal(deniedHost, 403);
    assert.equal(
      (
        await post("/api/projects/create", "{}", {
          Origin: "https://example.com",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/api/projects/create", "{}", {
          "Content-Type": "text/plain",
        })
      ).status,
      415,
    );
    assert.equal((await post("/api/projects/create", "{")).status, 400);
    assert.equal((await post("/api/projects/create", "")).status, 400);
    assert.equal((await post("/api/projects/create", "[]")).status, 400);
    assert.equal((await post("/api/unknown", "{}")).status, 404);
    assert.equal((await post("/api/projects/create/", "{}")).status, 404);
    assert.equal((await post("/API/projects/create", "{}")).status, 404);
    assert.equal(
      (await fetch(`${api.url}/api/state`, { method: "HEAD" })).status,
      404,
    );
    assert.equal(
      (await post("/api/unknown", "{}" + " ".repeat(99_998))).status,
      404,
    );
    assert.equal(
      (await post("/api/unknown", "{}" + " ".repeat(99_999))).status,
      413,
    );
    const chunkedOversized = await new Promise<number | undefined>(
      (resolve, reject) => {
        const request = httpRequest(
          `${api.url}/api/projects/create`,
          { method: "POST", headers },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        request.on("error", reject);
        request.write(" ".repeat(100_001));
        request.end();
      },
    );
    assert.equal(chunkedOversized, 413);
    assert.equal(
      (await post("/api/issues/evidence", "{}" + " ".repeat(5_004_998))).status,
      400,
    );
    assert.equal(
      (await post("/api/issues/evidence", "{}" + " ".repeat(5_004_999))).status,
      413,
    );
    assert.equal((await post("/api/test/reset", "{}")).status, 404);
    assert.deepEqual(api.store.snapshot(), original);
  } finally {
    await api.close();
  }
});

test("project routes use validated JSON and return the updated state", async () => {
  const api = await setup();
  try {
    const response = await fetch(`${api.url}/api/projects/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alpha" }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.deepEqual(await response.json(), {
      ...api.store.snapshot(),
      project: api.store.snapshot().projects.at(-1),
    });
  } finally {
    await api.close();
  }
});
