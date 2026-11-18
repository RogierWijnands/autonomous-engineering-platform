import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Issue, IssueDraft, IssueStatus, Project } from "../src/types.ts";
import { projectIssuePrefix } from "../src/utils/projectIssuePrefix.ts";

type IssueFields = IssueDraft & { status: IssueStatus };
type Snapshot = { projects: Project[]; issues: Issue[] };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIssueStatus(value: unknown): value is IssueStatus {
  return value === "To Do" || value === "In Progress" || value === "Done";
}

function isIssueFields(
  value: unknown,
): value is IssueFields & Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    typeof value.description === "string" &&
    (value.issueType === "Story" ||
      value.issueType === "Task" ||
      value.issueType === "Bug") &&
    (value.priority === "Highest" ||
      value.priority === "High" ||
      value.priority === "Medium" ||
      value.priority === "Low") &&
    isIssueStatus(value.status) &&
    Array.isArray(value.labels) &&
    Array.isArray(value.acceptanceCriteria) &&
    [...value.labels, ...value.acceptanceCriteria].every(
      (item: unknown) => typeof item === "string",
    )
  );
}

function isValidIssueFields(
  value: unknown,
): value is IssueFields & Record<string, unknown> {
  return (
    isIssueFields(value) &&
    Boolean(value.summary.trim()) &&
    value.summary.length <= 120 &&
    value.description.length <= 1000 &&
    [...value.labels, ...value.acceptanceCriteria].every(
      (item) => item.length <= 1000,
    )
  );
}

function isIssue(value: unknown): value is Issue {
  return (
    isIssueFields(value) &&
    typeof value.key === "string" &&
    typeof value.projectId === "string" &&
    (value.parentIssueKey === undefined ||
      typeof value.parentIssueKey === "string")
  );
}

function parseIssue(data: unknown): Issue {
  if (typeof data !== "string") {
    throw new Error("Invalid issue data in database.");
  }

  const issue: unknown = JSON.parse(data);

  if (!isIssue(issue)) {
    throw new Error("Invalid issue data in database.");
  }

  return issue;
}

export class InputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createStore(path: string) {
  const db = new DatabaseSync(path);

  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS issues (
      key TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_sequences (
      project_id TEXT PRIMARY KEY REFERENCES projects(id),
      last_number INTEGER NOT NULL
    );
  `);

  const insertProject = db.prepare(
    "INSERT INTO projects (id, name) VALUES (?, ?)",
  );
  const insertIssue = db.prepare(
    "INSERT INTO issues (key, project_id, data) VALUES (?, ?, ?)",
  );
  const updateIssue = db.prepare("UPDATE issues SET data = ? WHERE key = ?");

  const snapshot = (): Snapshot => ({
    projects: db
      .prepare("SELECT id, name FROM projects ORDER BY rowid")
      .all()
      .map((row) => {
        if (typeof row.id !== "string" || typeof row.name !== "string") {
          throw new Error("Invalid project data in database.");
        }

        return { id: row.id, name: row.name };
      }),
    issues: db
      .prepare("SELECT data FROM issues ORDER BY rowid DESC")
      .all()
      .map(({ data }) => parseIssue(data)),
  });

  const transaction = <T>(callback: () => T): T => {
    db.exec("BEGIN IMMEDIATE");

    try {
      const result = callback();

      db.exec("COMMIT");

      return result;
    } catch (error) {
      db.exec("ROLLBACK");

      throw error;
    }
  };

  const getProject = (id: unknown): Project => {
    if (typeof id !== "string") {
      throw new InputError("Invalid project ID.");
    }

    const project = db
      .prepare("SELECT id, name FROM projects WHERE id = ?")
      .get(id);

    if (!project) {
      throw new InputError("Project not found.", 404);
    }

    if (typeof project.id !== "string" || typeof project.name !== "string") {
      throw new Error("Invalid project data in database.");
    }

    return { id: project.id, name: project.name };
  };

  const getIssue = (key: unknown): Issue => {
    if (typeof key !== "string") {
      throw new InputError("Invalid issue key.");
    }

    const row = db.prepare("SELECT data FROM issues WHERE key = ?").get(key);

    if (!row) {
      throw new InputError("Issue not found.", 404);
    }

    return parseIssue(row.data);
  };

  const saveIssue = (issue: Issue) =>
    updateIssue.run(JSON.stringify(issue), issue.key);
  const projectIssues = (id: string) =>
    snapshot().issues.filter((issue) => issue.projectId === id);

  const ensureSequence = (id: string) => {
    const latest = projectIssues(id).reduce(
      (max, issue) =>
        Math.max(max, Number(issue.key.match(/\d+$/)?.[0] ?? 1000)),
      1000,
    );

    db.prepare(
      "INSERT OR IGNORE INTO project_sequences (project_id, last_number) VALUES (?, ?)",
    ).run(id, latest);
  };

  const checkAffectedIssues = (expected: unknown, actual: Issue[]) => {
    if (
      !Array.isArray(expected) ||
      !expected.every((key: unknown) => typeof key === "string")
    ) {
      throw new InputError("Invalid affected issue list.");
    }

    const keys = new Set<unknown>(expected);

    if (
      keys.size !== expected.length ||
      keys.size !== actual.length ||
      actual.some((issue) => !keys.has(issue.key))
    ) {
      throw new InputError(
        "Related issues have changed. Refresh and review the deletion again.",
        409,
      );
    }
  };

  function validateProject(
    name: unknown,
    id?: unknown,
  ): asserts name is string {
    if (
      typeof name !== "string" ||
      name !== name.trim() ||
      name.length < 1 ||
      name.length > 80
    ) {
      throw new InputError("Invalid project name.");
    }

    const prefix = projectIssuePrefix(name);

    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)) {
      throw new InputError("Invalid project prefix.");
    }

    if (
      snapshot().projects.some(
        (project) =>
          project.id !== id &&
          (project.name.toLowerCase() === name.toLowerCase() ||
            projectIssuePrefix(project.name) === prefix),
      )
    ) {
      throw new InputError("Project name or prefix already exists.", 409);
    }
  }

  return {
    snapshot,
    close: () => db.close(),
    resetTestData(data: unknown) {
      if (
        !isRecord(data) ||
        !Array.isArray(data.projects) ||
        !Array.isArray(data.issues)
      ) {
        throw new InputError("Invalid test data.");
      }

      const projects: unknown[] = data.projects;
      const issues: unknown[] = data.issues;

      return transaction(() => {
        db.exec(
          "DELETE FROM project_sequences; DELETE FROM issues; DELETE FROM projects",
        );

        for (const project of projects) {
          if (
            !isRecord(project) ||
            typeof project.id !== "string" ||
            typeof project.name !== "string"
          ) {
            throw new InputError("Invalid test data.");
          }

          insertProject.run(project.id, project.name);
        }

        for (const issue of [...issues].reverse()) {
          if (!isIssue(issue)) {
            throw new InputError("Invalid test data.");
          }

          insertIssue.run(issue.key, issue.projectId, JSON.stringify(issue));
        }

        return snapshot();
      });
    },

    createProject(name: unknown) {
      return transaction(() => {
        validateProject(name);

        const project = { id: randomUUID(), name };

        insertProject.run(project.id, project.name);

        return { ...snapshot(), project };
      });
    },

    updateProject(id: unknown, name: unknown) {
      return transaction(() => {
        const project = getProject(id);

        validateProject(name, id);

        const oldPrefix = projectIssuePrefix(project.name);
        const newPrefix = projectIssuePrefix(name);
        const issues = projectIssues(project.id);

        db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(
          name,
          project.id,
        );

        if (oldPrefix !== newPrefix) {
          db.prepare("DELETE FROM issues WHERE project_id = ?").run(project.id);

          for (const issue of [...issues].reverse()) {
            issue.key = newPrefix + issue.key.slice(oldPrefix.length);

            if (issue.parentIssueKey) {
              issue.parentIssueKey =
                newPrefix + issue.parentIssueKey.slice(oldPrefix.length);
            }

            insertIssue.run(issue.key, project.id, JSON.stringify(issue));
          }
        }

        return snapshot();
      });
    },

    deleteProject(id: unknown, expectedIssueKeys: unknown) {
      return transaction(() => {
        const project = getProject(id);

        checkAffectedIssues(expectedIssueKeys, projectIssues(project.id));
        db.prepare("DELETE FROM project_sequences WHERE project_id = ?").run(
          project.id,
        );
        db.prepare("DELETE FROM issues WHERE project_id = ?").run(project.id);
        db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);

        return snapshot();
      });
    },

    createIssue(projectId: unknown, draft: unknown, parentIssueKey?: unknown) {
      return transaction(() => {
        const project = getProject(projectId);
        const issue = { ...(isRecord(draft) ? draft : {}), status: "To Do" };

        if (!isValidIssueFields(issue)) {
          throw new InputError("Invalid issue data.");
        }

        let parentKey: string | undefined;

        if (parentIssueKey !== undefined) {
          const parent = getIssue(parentIssueKey);

          if (
            parent.projectId !== project.id ||
            parent.issueType !== "Story" ||
            parent.parentIssueKey ||
            issue.issueType !== "Task"
          ) {
            throw new InputError("Invalid subtask parent.");
          }

          parentKey = parent.key;
        }

        ensureSequence(project.id);

        const sequence = db
          .prepare(
            "SELECT last_number FROM project_sequences WHERE project_id = ?",
          )
          .get(project.id);

        if (!sequence || typeof sequence.last_number !== "number") {
          throw new Error("Invalid project sequence in database.");
        }

        const nextNumber = sequence.last_number + 1;

        db.prepare(
          "UPDATE project_sequences SET last_number = ? WHERE project_id = ?",
        ).run(nextNumber, project.id);

        const created: Issue = {
          key: `${projectIssuePrefix(project.name)}-${nextNumber}`,
          projectId: project.id,
          summary: issue.summary,
          description: issue.description,
          issueType: issue.issueType,
          priority: issue.priority,
          status: issue.status,
          labels: issue.labels,
          acceptanceCriteria: issue.acceptanceCriteria,
          ...(parentKey ? { parentIssueKey: parentKey } : {}),
        };

        insertIssue.run(created.key, project.id, JSON.stringify(created));

        return { ...snapshot(), issue: created };
      });
    },

    updateIssue(key: unknown, data: unknown) {
      return transaction(() => {
        const current = getIssue(key);

        if (!isValidIssueFields(data)) {
          throw new InputError("Invalid issue data.");
        }

        if (
          data.key !== key ||
          data.projectId !== current.projectId ||
          data.parentIssueKey !== current.parentIssueKey ||
          (current.parentIssueKey && data.issueType !== "Task")
        ) {
          throw new InputError("Invalid issue identity or subtask type.");
        }

        const updated: Issue = {
          ...current,
          summary: data.summary,
          description: data.description,
          issueType: data.issueType,
          priority: data.priority,
          status: data.status,
          labels: data.labels,
          acceptanceCriteria: data.acceptanceCriteria,
        };

        saveIssue(updated);

        if (current.issueType === "Story" && updated.issueType !== "Story") {
          for (const child of projectIssues(current.projectId).filter(
            (issue) => issue.parentIssueKey === key,
          )) {
            delete child.parentIssueKey;
            saveIssue(child);
          }
        }

        return snapshot();
      });
    },

    deleteIssue(key: unknown, expectedSubtaskKeys: unknown) {
      return transaction(() => {
        const issue = getIssue(key);
        const children = projectIssues(issue.projectId).filter(
          (item) => item.parentIssueKey === key,
        );

        checkAffectedIssues(expectedSubtaskKeys, children);
        ensureSequence(issue.projectId);

        const remove = db.prepare(
          "DELETE FROM issues WHERE key = ? AND project_id = ?",
        );

        for (const child of children) remove.run(child.key, issue.projectId);

        remove.run(issue.key, issue.projectId);

        return snapshot();
      });
    },

    makeStandalone(key: unknown, status: unknown) {
      return transaction(() => {
        const issue = getIssue(key);

        if (!issue.parentIssueKey || !isIssueStatus(status)) {
          throw new InputError("Invalid standalone task.");
        }

        delete issue.parentIssueKey;
        issue.status = status;
        saveIssue(issue);

        return snapshot();
      });
    },

    makeSubtask(key: unknown, parentKey: unknown) {
      return transaction(() => {
        const issue = getIssue(key);
        const parent = getIssue(parentKey);

        if (
          issue.projectId !== parent.projectId ||
          parent.parentIssueKey ||
          key === parentKey ||
          issue.parentIssueKey === parentKey
        ) {
          throw new InputError("Invalid subtask parent.");
        }

        for (const child of projectIssues(issue.projectId).filter(
          (item) => item.parentIssueKey === key,
        )) {
          delete child.parentIssueKey;
          saveIssue(child);
        }

        issue.issueType = "Task";
        issue.parentIssueKey = parent.key;
        parent.issueType = "Story";
        saveIssue(issue);
        saveIssue(parent);

        return snapshot();
      });
    },
  };
}
