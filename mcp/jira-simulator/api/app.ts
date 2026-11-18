import express, { type ErrorRequestHandler } from "express";
import { MAX_EVIDENCE_BYTES } from "../src/utils/evidence.ts";
import { isRecord } from "../src/utils/issueValidation.ts";
import { InputError, type createStore } from "./database/store.ts";
import { issueRoutes } from "./routes/issues.ts";
import { projectRoutes } from "./routes/projects.ts";
import { testRoutes } from "./routes/testing.ts";
import { createExecuteJiraIssueWebhook } from "./webhooks/executeJiraIssueWebhook.ts";

export function createApp(
  port: number,
  store: ReturnType<typeof createStore>,
  webhookUrl = process.env.JIRA_EXECUTION_WEBHOOK_URL,
) {
  const app = express();
  const sendJiraIssueExecutionWebhook =
    createExecuteJiraIssueWebhook(webhookUrl);

  // Keep route matching compatible with the original API contract.
  app.disable("x-powered-by");
  app.enable("case sensitive routing");
  app.enable("strict routing");

  // Reject unexpected hosts and browser origins before reading request bodies.
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.headers.host !== `127.0.0.1:${port}`) {
      return next(new InputError("Invalid host.", 403));
    }
    if (
      req.headers.origin &&
      !["http://127.0.0.1:5173", "http://127.0.0.1:4173"].includes(
        req.headers.origin,
      )
    ) {
      return next(new InputError("Invalid origin.", 403));
    }
    if (req.method !== "GET" && req.method !== "POST") {
      return next(new InputError("Not found.", 404));
    }
    next();
  });

  // Evidence can contain embedded images, so it has a separate body limit.
  const json = (limit: number) =>
    express.json({
      limit,
      strict: false,
      inflate: false,
      type: () => true,
      verify: (_req, _res, body) => {
        if (body.length === 0) throw new InputError("Invalid JSON.");
      },
    });
  const normalJson = json(100_000);
  const evidenceJson = json(MAX_EVIDENCE_BYTES * 2 + 5_000);

  // Accept JSON objects only; all write routes share this validation.
  app.use((req, res, next) => {
    if (req.method !== "POST") return next();
    if (req.headers["content-type"]?.split(";")[0] !== "application/json") {
      return next(new InputError("Expected JSON.", 415));
    }
    const parser =
      req.path === "/api/issues/evidence" ? evidenceJson : normalJson;
    parser(req, res, next);
  });
  app.use((req, _res, next) => {
    if (req.method !== "POST") return next();
    if (req.body === undefined) return next(new InputError("Invalid JSON."));
    if (!isRecord(req.body)) return next(new InputError("Invalid request."));
    next();
  });

  // Route accepted requests and keep unknown paths in the same error format.
  app.get("/api/state", (_req, res) => res.json(store.snapshot()));
  app.use(
    "/api",
    issueRoutes(store, sendJiraIssueExecutionWebhook),
    projectRoutes(store),
    testRoutes(store),
  );
  app.use((_req, _res, next) => next(new InputError("Not found.", 404)));

  // Expose expected client errors without leaking unexpected internal failures.
  const handleError: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (error instanceof InputError) {
      res.status(error.status).json({ error: error.message });
    } else if (isRecord(error) && error.type === "entity.too.large") {
      res.status(413).json({ error: "Request too large." });
    } else if (error instanceof URIError) {
      res.status(400).json({ error: "Invalid issue key." });
    } else if (
      isRecord(error) &&
      (error.type === "entity.parse.failed" ||
        error.type === "entity.verify.failed" ||
        error.type === "encoding.unsupported" ||
        error.type === "charset.unsupported")
    ) {
      res.status(400).json({ error: "Invalid JSON." });
    } else {
      console.error("Simulator API request failed:", error);
      res
        .status(500)
        .json({ error: "The simulator could not complete the request." });
    }
  };
  app.use(handleError);
  return app;
}
