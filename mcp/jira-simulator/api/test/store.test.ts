import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore, InputError } from "../database/store.ts";
import { initialProjects } from "../../src/test/fixtures/projects.ts";
import { initialIssues } from "../../src/test/fixtures/issues.ts";

test("persists project repositories and optional issue overrides without losing unrelated updates", () => {
  const store = createStore(":memory:");
  try {
    const project = store.createProject("Alpha", "owner/default").project;
    const issue = store.createIssue(project.id, {
      summary: "Issue",
      description: "",
      issueType: "Task",
      priority: "Medium",
      labels: [],
      acceptanceCriteria: [],
      repository: "owner/override",
    }).issue;
    assert.equal(store.getProject(project.id).repository, "owner/default");
    assert.equal(store.getIssue(issue.key).repository, "owner/override");
    store.updateProject(project.id, "Beta");
    const renamed = store.snapshot().issues[0];
    assert.equal(store.getProject(project.id).repository, "owner/default");
    assert.equal(renamed.repository, "owner/override");
    const { repository: _ignored, ...withoutRepository } = renamed;
    store.updateIssue(renamed.key, withoutRepository);
    assert.equal(store.getIssue(renamed.key).repository, "owner/override");
    store.updateIssue(renamed.key, { ...renamed, repository: "" });
    assert.equal(store.getIssue(renamed.key).repository, undefined);
    assert.throws(() => store.updateProject(project.id, "Beta", ""), {
      status: 400,
    });
    assert.equal(store.getProject(project.id).repository, "owner/default");
    for (const repository of [
      "https://example.com/repo",
      "../evil",
      "owner/.",
      "owner/repo.git",
      "<script>",
    ]) {
      assert.throws(() => store.updateProject(project.id, "Beta", repository), {
        status: 400,
      });
      assert.throws(
        () => store.updateIssue(renamed.key, { ...renamed, repository }),
        { status: 400 },
      );
    }
  } finally {
    store.close();
  }
});

test("requires a valid repository for project creation and legacy project updates", () => {
  const store = createStore(":memory:");
  try {
    for (const repository of [undefined, "", " ", "owner/.", null]) {
      assert.throws(() => store.createProject("Alpha", repository), {
        status: 400,
      });
    }
    store.resetTestData({
      projects: [{ id: "legacy", name: "Legacy" }],
      issues: [],
    });
    assert.throws(() => store.updateProject("legacy", "Renamed"), {
      status: 400,
    });
    assert.equal(store.getProject("legacy").name, "Legacy");
    store.updateProject("legacy", "Legacy", "owner/repo");
    assert.equal(store.getProject("legacy").repository, "owner/repo");
  } finally {
    store.close();
  }
});

test("migrates an existing project database without losing its projects or issues", () => {
  const directory = mkdtempSync(join(tmpdir(), "jira-repo-migration-"));
  const path = join(directory, "test.sqlite");
  try {
    const old = new DatabaseSync(path);
    old.exec(
      "CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT INTO projects VALUES ('legacy', 'Legacy'); CREATE TABLE issues (key TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), data TEXT NOT NULL);",
    );
    const legacyIssue = {
      ...initialIssues[0],
      key: "LEGACY-1001",
      projectId: "legacy",
    };
    old
      .prepare("INSERT INTO issues VALUES (?, ?, ?)")
      .run(legacyIssue.key, legacyIssue.projectId, JSON.stringify(legacyIssue));
    old.close();
    const store = createStore(path);
    try {
      assert.deepEqual(store.snapshot(), {
        projects: [{ id: "legacy", name: "Legacy" }],
        issues: [legacyIssue],
      });
      store.updateProject("legacy", "Legacy", "owner/repo");
    } finally {
      store.close();
    }
    const reopened = createStore(path);
    try {
      assert.equal(reopened.getProject("legacy").repository, "owner/repo");
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("stores SQL and markup payloads as literal project and issue data", () => {
  const store = createStore(":memory:");
  try {
    const payload = "Demo'; DROP TABLE issues; -- <script>alert(1)</script>";
    const project = store.createProject(payload, "owner/repo").project;
    const issue = store.createIssue(project.id, {
      summary: payload,
      description: payload,
      issueType: "Task",
      priority: "Medium",
      labels: [payload],
      acceptanceCriteria: [payload],
    }).issue;

    assert.equal(store.getIssue(issue.key).summary, payload);
    assert.deepEqual(store.snapshot().projects, [project]);
    assert.deepEqual(store.getIssue(issue.key).labels, [payload]);
    assert.equal(store.getIssue(issue.key).description, payload);
    assert.deepEqual(store.getIssue(issue.key).acceptanceCriteria, [payload]);
    assert.throws(() => store.getIssue("' OR 1=1 --"), { status: 404 });
    assert.deepEqual(store.snapshot().issues, [issue]);
  } finally {
    store.close();
  }
});

test("creates issues with a validated initial status and preserves the default", () => {
  const store = createStore(":memory:");
  try {
    const project = store.createProject("Alpha", "owner/repo").project;
    const draft = {
      summary: "Issue",
      description: "",
      issueType: "Task",
      priority: "Medium",
      labels: [],
      acceptanceCriteria: [],
    };
    assert.equal(
      store.createIssue(project.id, { ...draft, status: "Done" }).issue.status,
      "To Do",
    );
    for (const status of ["To Do", "In Progress", "Done"]) {
      assert.equal(
        store.createIssue(project.id, draft, undefined, status).issue.status,
        status,
      );
    }
    const before = store.snapshot();
    for (const invalid of [null, "", "Blocked", 1, {}]) {
      assert.throws(
        () => store.createIssue(project.id, draft, undefined, invalid),
        { status: 400 },
      );
      assert.deepEqual(store.snapshot(), before);
    }
  } finally {
    store.close();
  }
});

test("saves evidence separately and rejects stale or unsafe edits", () => {
  const store = createStore(":memory:");

  try {
    store.resetTestData({ projects: initialProjects, issues: initialIssues });
    const original = store
      .snapshot()
      .issues.find((issue) => issue.key === "DEMO-1001");
    assert.ok(original);
    const evidence = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Tests passed" }],
        },
      ],
    };

    store.updateEvidence(original.key, null, evidence);
    const saved = store
      .snapshot()
      .issues.find((issue) => issue.key === original.key);
    assert.deepEqual(saved?.evidence, evidence);
    assert.equal(saved?.description, original.description);

    assert.throws(() => store.updateEvidence(original.key, null, evidence), {
      status: 409,
    });
    assert.throws(
      () =>
        store.updateEvidence(original.key, evidence, {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: { src: "https://example.com/image.png", alt: "Image" },
            },
          ],
        }),
      { status: 400 },
    );
    assert.throws(() => store.updateEvidence("MISSING", null, evidence), {
      status: 404,
    });

    store.updateIssue(original.key, { ...original, status: "Done" });
    assert.deepEqual(
      store.snapshot().issues.find((issue) => issue.key === original.key)
        ?.evidence,
      evidence,
    );
  } finally {
    store.close();
  }
});

test("completes only issues currently In Progress", () => {
  const store = createStore(":memory:");

  try {
    store.resetTestData({ projects: initialProjects, issues: initialIssues });
    assert.throws(() => store.completeIssue("DEMO-1002"), { status: 409 });
    assert.throws(() => store.completeIssue("DEMO-1003"), { status: 409 });
    assert.throws(() => store.completeIssue("MISSING"), { status: 404 });
    store.completeIssue("DEMO-1001");
    assert.equal(
      store.snapshot().issues.find((issue) => issue.key === "DEMO-1001")
        ?.status,
      "Done",
    );
    assert.throws(() => store.completeIssue("DEMO-1001"), { status: 409 });
  } finally {
    store.close();
  }
});

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
    store.createProject("User Project", "owner/repo");

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

    const project = store.createProject("Alpha Project", "owner/repo").project;
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
    const evidence = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Verified" }] },
      ],
    };
    store.updateEvidence("BETA-1001", null, evidence);
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
    assert.deepEqual(
      state.issues.find((item) => item.key === "BETA-1001")?.evidence,
      evidence,
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

    const project = store.createProject("Alpha Project", "owner/repo").project;
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
    const project = store.createProject("Alpha Project", "owner/repo").project;

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

    const other = store.createProject("Other Project", "owner/repo").project;
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
