import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore, InputError } from "./store.ts";
import { initialProjects } from "../src/test/fixtures/projects.ts";
import { initialIssues } from "../src/test/fixtures/issues.ts";

test("a new empty database stays empty after reopening", () => {
  const directory = mkdtempSync(join(tmpdir(), "jira-simulator-test-"));
  const path = join(directory, "test.sqlite");

  try {
    let store = createStore(path);

    assert.deepEqual(store.snapshot(), { projects: [], issues: [] });

    store.close();
    store = createStore(path);

    assert.deepEqual(store.snapshot(), { projects: [], issues: [] });

    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("preserves existing seeded databases and user changes", () => {
  const directory = mkdtempSync(join(tmpdir(), "jira-simulator-test-"));
  const path = join(directory, "test.sqlite");

  try {
    let store = createStore(path);

    store.resetTestData({ projects: initialProjects, issues: initialIssues });
    store.createProject("User Project");

    const before = store.snapshot();

    store.close();

    const legacy = new DatabaseSync(path);

    legacy.exec(
      "CREATE TABLE metadata (key TEXT PRIMARY KEY); INSERT INTO metadata VALUES ('seeded')",
    );
    legacy.close();
    store = createStore(path);

    assert.deepEqual(store.snapshot(), before);

    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("persists projects, issues and their relationships across restarts", () => {
  const directory = mkdtempSync(join(tmpdir(), "jira-simulator-test-"));
  const path = join(directory, "test.sqlite");

  try {
    let store = createStore(path);

    assert.deepEqual(store.snapshot(), { projects: [], issues: [] });

    const project = store.createProject("Alpha Project").project;
    const draft = {
      summary: "Story",
      description: "",
      issueType: "Story",
      priority: "High",
      labels: [],
      acceptanceCriteria: [],
    };
    const story = store.createIssue(project.id, draft).issue;
    const child = store.createIssue(
      project.id,
      { ...draft, summary: "Child", issueType: "Task" },
      story.key,
    ).issue;

    store.updateProject(project.id, "Beta Project");
    store.updateIssue("BETA-1001", {
      ...story,
      key: "BETA-1001",
      status: "Done",
    });
    store.close();
    store = createStore(path);

    const state = store.snapshot();

    assert.equal(
      state.projects.find((item) => item.id === project.id)?.name,
      "Beta Project",
    );
    assert.equal(
      state.issues.find((item) => item.key === "BETA-1001")?.status,
      "Done",
    );
    assert.equal(
      state.issues.find((item) => item.key === "BETA-1002")?.parentIssueKey,
      "BETA-1001",
    );

    store.makeStandalone("BETA-1002", "In Progress");
    store.makeSubtask("BETA-1002", "BETA-1001");

    assert.equal(
      store.snapshot().issues.find((item) => item.key === "BETA-1002")
        ?.parentIssueKey,
      "BETA-1001",
    );

    store.updateIssue("BETA-1001", {
      ...state.issues.find((item) => item.key === "BETA-1001"),
      issueType: "Bug",
    });

    const detached = store
      .snapshot()
      .issues.find((item) => item.key === "BETA-1002");

    assert.ok(detached);
    assert.equal(detached.parentIssueKey, undefined);
    assert.equal(child.key, "ALPHA-1002");

    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects invalid input and leaves transactions unchanged", () => {
  const store = createStore(":memory:");

  try {
    store.resetTestData({ projects: initialProjects, issues: initialIssues });

    const project = store.createProject("Alpha Project").project;
    const before = store.snapshot();

    assert.throws(
      () => store.updateProject(project.id, "Demo Other"),
      InputError,
    );
    assert.throws(
      () => store.makeSubtask("DEMO-1001", "DEMO-1008"),
      InputError,
    );
    assert.throws(
      () =>
        store.updateIssue("DEMO-1008", {
          ...before.issues.find((issue) => issue.key === "DEMO-1008"),
          issueType: "Story",
        }),
      InputError,
    );
    assert.throws(
      () => store.createIssue(project.id, { summary: "" }),
      InputError,
    );
    assert.deepEqual(store.snapshot(), before);
  } finally {
    store.close();
  }
});

test("rejects malformed test data without clearing existing data", () => {
  const store = createStore(":memory:");

  try {
    store.resetTestData({ projects: initialProjects, issues: initialIssues });

    const before = store.snapshot();

    assert.throws(
      () =>
        store.resetTestData({
          projects: initialProjects,
          issues: [{ key: "invalid" }],
        }),
      InputError,
    );
    assert.deepEqual(store.snapshot(), before);
  } finally {
    store.close();
  }
});

test("reports invalid stored issue data rather than returning an invalid snapshot", () => {
  const directory = mkdtempSync(join(tmpdir(), "jira-simulator-test-"));
  const path = join(directory, "test.sqlite");

  try {
    const store = createStore(path);
    const project = store.createProject("Alpha Project").project;

    store.close();

    const db = new DatabaseSync(path);

    db.prepare(
      "INSERT INTO issues (key, project_id, data) VALUES (?, ?, ?)",
    ).run("ALPHA-1001", project.id, "{}");
    db.close();

    const reopened = createStore(path);

    try {
      assert.throws(
        () => reopened.snapshot(),
        /Invalid issue data in database/,
      );
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deletes only confirmed issues and does not reuse issue keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "jira-simulator-test-"));
  const path = join(directory, "test.sqlite");

  try {
    let store = createStore(path);

    store.resetTestData({ projects: initialProjects, issues: initialIssues });

    assert.throws(() => store.deleteIssue("DEMO-1001", ["DEMO-1008"]), {
      status: 409,
    });
    assert.throws(() => store.deleteIssue("DEMO-1001", null), { status: 400 });
    assert.throws(() => store.deleteIssue("NOT-FOUND", []), { status: 404 });

    store.deleteIssue("DEMO-1001", ["DEMO-1008", "DEMO-1009"]);

    assert.equal(store.snapshot().issues.length, 6);
    assert.ok(
      store.snapshot().issues.some((issue) => issue.key === "DEMO-1002"),
    );

    store.close();
    store = createStore(path);

    const draft = {
      summary: "New issue",
      description: "",
      issueType: "Task",
      priority: "Medium",
      labels: [],
      acceptanceCriteria: [],
    };

    assert.equal(
      store.createIssue("project-demo", draft).issue.key,
      "DEMO-1010",
    );

    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deletes a project atomically without affecting other projects", () => {
  const store = createStore(":memory:");

  try {
    store.resetTestData({ projects: initialProjects, issues: initialIssues });

    const other = store.createProject("Other Project").project;
    const before = store.snapshot();

    assert.throws(() => store.deleteProject("project-demo", []), {
      status: 409,
    });
    assert.throws(() => store.deleteProject(other.id, ["DEMO-1001"]), {
      status: 409,
    });
    assert.deepEqual(store.snapshot(), before);

    const result = store.deleteProject(
      "project-demo",
      initialIssues.map((issue) => issue.key),
    );

    assert.deepEqual(
      result.projects.map((project) => project.id),
      [other.id],
    );
    assert.deepEqual(result.issues, []);
    assert.throws(() => store.deleteProject("project-demo", []), {
      status: 404,
    });
  } finally {
    store.close();
  }
});

test("deleting a subtask leaves its Story and sibling intact", () => {
  const store = createStore(":memory:");

  try {
    store.resetTestData({ projects: initialProjects, issues: initialIssues });

    const result = store.deleteIssue("DEMO-1008", []);

    assert.ok(result.issues.some((issue) => issue.key === "DEMO-1001"));
    assert.ok(
      result.issues.some(
        (issue) =>
          issue.key === "DEMO-1009" && issue.parentIssueKey === "DEMO-1001",
      ),
    );
    assert.ok(!result.issues.some((issue) => issue.key === "DEMO-1008"));
  } finally {
    store.close();
  }
});
