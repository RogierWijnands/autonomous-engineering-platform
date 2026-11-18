import { constants as fileSystemConstants } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createStore, InputError, isRecord } from "./store.ts";

const port = Number(process.env.JIRA_API_PORT || 3001);
const database =
  process.env.JIRA_DB_PATH ||
  fileURLToPath(new URL("./jira.sqlite", import.meta.url));

if (process.env.JIRA_TEST_MODE === "1" && database !== ":memory:") {
  throw new Error("Test mode requires an in-memory database.");
}

const denyGroupAndOtherPermissions =
  fileSystemConstants.S_IRWXG | fileSystemConstants.S_IRWXO;

process.umask(denyGroupAndOtherPermissions);
const store = createStore(database);

const server = createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };

  try {
    // Restrict hosts and browser origins to prevent DNS rebinding and cross-origin requests.
    if (req.headers.host !== `127.0.0.1:${port}`) {
      throw new InputError("Invalid host.", 403);
    }

    if (
      req.headers.origin &&
      !["http://127.0.0.1:5173", "http://127.0.0.1:4173"].includes(
        req.headers.origin,
      )
    ) {
      throw new InputError("Invalid origin.", 403);
    }

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/api/state") {
      return send(200, store.snapshot());
    }

    if (req.method !== "POST") {
      throw new InputError("Not found.", 404);
    }

    if (req.headers["content-type"]?.split(";")[0] !== "application/json") {
      throw new InputError("Expected JSON.", 415);
    }

    let body = "";
    let bytes = 0;

    req.setEncoding("utf8");

    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      body += chunk;

      if (bytes > 100_000) {
        throw new InputError("Request too large.", 413);
      }
    }

    let data: unknown;

    try {
      data = JSON.parse(body);
    } catch {
      throw new InputError("Invalid JSON.");
    }

    if (!isRecord(data)) {
      throw new InputError("Invalid request.");
    }

    const payload = data;
    let result;

    switch (url.pathname) {
      case "/api/test/reset":
        if (process.env.JIRA_TEST_MODE !== "1") {
          throw new InputError("Not found.", 404);
        }

        if (
          !Array.isArray(payload.projects) ||
          !Array.isArray(payload.issues)
        ) {
          throw new InputError("Invalid test data.");
        }

        result = store.resetTestData(payload);
        break;
      case "/api/projects/create":
        result = store.createProject(payload.name);
        break;
      case "/api/projects/update":
        result = store.updateProject(payload.id, payload.name);
        break;
      case "/api/projects/delete":
        result = store.deleteProject(payload.id, payload.issueKeys);
        break;
      case "/api/issues/create":
        result = store.createIssue(
          payload.projectId,
          payload.draft,
          payload.parentIssueKey,
        );
        break;
      case "/api/issues/update": {
        const issue = payload.issue;
        const key =
          issue && typeof issue === "object" && "key" in issue
            ? issue.key
            : undefined;

        result = store.updateIssue(key, issue);
        break;
      }
      case "/api/issues/delete":
        result = store.deleteIssue(payload.key, payload.subtaskKeys);
        break;
      case "/api/issues/standalone":
        result = store.makeStandalone(payload.key, payload.status);
        break;
      case "/api/issues/subtask":
        result = store.makeSubtask(payload.key, payload.parentKey);
        break;
      default:
        throw new InputError("Not found.", 404);
    }

    send(200, result);
  } catch (error) {
    if (error instanceof InputError) {
      send(error.status, { error: error.message });
    } else {
      console.error("Simulator API request failed:", error);
      send(500, { error: "The simulator could not complete the request." });
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Jira Simulator API listening on 127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
}
