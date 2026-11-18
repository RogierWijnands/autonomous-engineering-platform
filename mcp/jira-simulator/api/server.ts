import { constants as fileSystemConstants } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createStore } from "./database/store.ts";
import { createApp } from "./app.ts";

// Test resets must never target a persistent database.
const port = Number(process.env.JIRA_API_PORT || 3001);
const database =
  process.env.JIRA_DB_PATH ||
  fileURLToPath(new URL("./database/jira.sqlite", import.meta.url));

if (process.env.JIRA_TEST_MODE === "1" && database !== ":memory:") {
  throw new Error("Test mode requires an in-memory database.");
}

// Restrict newly created database files and bind the API to loopback.
const denyGroupAndOtherPermissions =
  fileSystemConstants.S_IRWXG | fileSystemConstants.S_IRWXO;

process.umask(denyGroupAndOtherPermissions);
const store = createStore(database);
const server = createServer(createApp(port, store)).listen(
  port,
  "127.0.0.1",
  () => {
    console.log(`Jira Simulator API listening on 127.0.0.1:${port}`);
  },
);

// Close the database after the HTTP server stops accepting requests.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
}
