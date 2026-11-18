import { Router, type Request, type Response } from "express";
import { InputError, type createStore } from "../database/store.ts";

type Store = ReturnType<typeof createStore>;

// MCP callers can request the changed issue instead of the full UI snapshot.
function sendUpdate(
  req: Request,
  res: Response,
  result: ReturnType<Store["snapshot"]>,
  key: unknown,
) {
  if (
    new URL(req.originalUrl, "http://127.0.0.1").searchParams.get(
      "response",
    ) !== "issue"
  ) {
    res.json(result);
    return;
  }
  const issue = result.issues.find((item) => item.key === key);
  if (!issue) throw new Error("Updated issue missing from snapshot.");
  res.json({ issue });
}

export function issueRoutes(
  store: Store,
  sendJiraIssueExecutionWebhook: (issueKey: string) => Promise<void>,
) {
  const router = Router({ caseSensitive: true, strict: true });

  // Lists expose summaries only; a single-issue read includes the full record.
  router.get("/issues", (req, res) => {
    const projectId = new URL(
      req.originalUrl,
      "http://127.0.0.1",
    ).searchParams.get("projectId");
    if (projectId !== null && (!projectId || projectId.length > 100)) {
      throw new InputError("Invalid project ID.");
    }

    const state = store.snapshot();
    res.json({
      projects: projectId
        ? state.projects.filter((project) => project.id === projectId)
        : state.projects,
      issues: state.issues
        .filter((issue) => !projectId || issue.projectId === projectId)
        .map(({ key, projectId, summary, status }) => ({
          key,
          projectId,
          summary,
          status,
        })),
    });
  });

  router.get("/issues/:key", (req, res) => {
    res.json({ issue: store.getIssue(req.params.key) });
  });

  router.post("/issues/create", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(
      store.createIssue(
        payload.projectId,
        payload.draft,
        payload.parentIssueKey,
        payload.status,
      ),
    );
  });

  router.post("/issues/update", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    const issue = payload.issue;
    const key =
      issue && typeof issue === "object" && "key" in issue
        ? issue.key
        : undefined;
    res.json(store.updateIssue(key, issue));
  });

  // Evidence rejects stale edits; completion accepts only In Progress issues.
  router.post("/issues/evidence", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    const result = store.updateEvidence(
      payload.key,
      payload.expected,
      payload.evidence,
    );
    sendUpdate(req, res, result, payload.key);
  });

  router.post("/issues/complete", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    const result = store.completeIssue(payload.key);
    sendUpdate(req, res, result, payload.key);
  });

  // A confirmation requests a new execution; it does not change issue status.
  router.post("/issues/execute", async (req, res) => {
    const payload: Record<string, unknown> = req.body;
    const issue = store.getIssue(payload.key);
    await sendJiraIssueExecutionWebhook(issue.key);
    res.status(202).json({ delivered: true });
  });

  // Deletion and relationship changes are validated atomically by the store.
  router.post("/issues/delete", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(store.deleteIssue(payload.key, payload.subtaskKeys));
  });

  router.post("/issues/standalone", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(store.makeStandalone(payload.key, payload.status));
  });

  router.post("/issues/subtask", (req, res) => {
    const payload: Record<string, unknown> = req.body;
    res.json(store.makeSubtask(payload.key, payload.parentKey));
  });

  return router;
}
