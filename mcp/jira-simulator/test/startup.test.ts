import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createStore } from "../api/database/store.ts";

function copyApiFixture() {
  const fixture = mkdtempSync(join(tmpdir(), "jira-api-startup-"));
  for (const file of [
    "app.ts",
    "server.ts",
    "database/store.ts",
    "webhooks/executeJiraIssueWebhook.ts",
  ]) {
    mkdirSync(dirname(join(fixture, "api", file)), { recursive: true });
    copyFileSync(join("api", file), join(fixture, "api", file));
  }
  cpSync("api/routes", join(fixture, "api", "routes"), { recursive: true });
  cpSync("src", join(fixture, "src"), { recursive: true });
  copyFileSync("package.json", join(fixture, "package.json"));
  symlinkSync(resolve("node_modules"), join(fixture, "node_modules"), "dir");
  return fixture;
}

async function reservePort() {
  const server = createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  assert.ok(address && typeof address !== "string");

  return { server, port: address.port };
}

test(
  "restarts the API when an imported module changes",
  { timeout: 20_000 },
  async () => {
    const port = await reservePort();
    await new Promise<void>((resolve, reject) =>
      port.server.close((error) => (error ? reject(error) : resolve())),
    );
    const fixture = copyApiFixture();
    let output = "";

    try {
      const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
      const command = scripts.start.match(/"(nodemon [^"]+)"/)?.[1];
      assert.ok(command, "The simulator start script must launch nodemon.");
      const args = command.split(" ").slice(1);
      const child = spawn(
        process.execPath,
        [resolve("node_modules/nodemon/bin/nodemon.js"), ...args],
        {
          cwd: fixture,
          env: {
            ...process.env,
            JIRA_TEST_MODE: "1",
            JIRA_DB_PATH: ":memory:",
            JIRA_API_PORT: String(port.port),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));

      const waitForHeader = async (value: string | null) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (child.exitCode !== null) throw new Error(output);
          try {
            const response = await fetch(
              `http://127.0.0.1:${port.port}/api/state`,
            );
            if (response.ok && response.headers.get("x-reload-test") === value)
              return;
          } catch (error) {
            if (!(error instanceof TypeError)) throw error;
          }
          await delay(100);
        }
        throw new Error(`API did not reload as expected:\n${output}`);
      };

      try {
        await waitForHeader(null);
        const app = join(fixture, "api", "app.ts");
        const original = readFileSync(app, "utf8");
        const updated = original.replace(
          '"X-Content-Type-Options": "nosniff",',
          '"X-Content-Type-Options": "nosniff",\n      "X-Reload-Test": "updated",',
        );
        assert.notEqual(updated, original);
        writeFileSync(app, updated);
        await waitForHeader("updated");
      } finally {
        if (child.exitCode === null) {
          child.kill("SIGTERM");
          await once(child, "close");
        }
      }
      assert.equal(await isListening(port.port), false, output);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);

test(
  "starts with the default database or an explicitly configured database",
  { timeout: 15_000 },
  async () => {
    const fixture = copyApiFixture();
    const current = join(fixture, "api", "database", "jira.sqlite");
    const custom = join(fixture, "custom.sqlite");
    const defaultStore = createStore(current);
    defaultStore.createProject("Default Project");
    const defaultSnapshot = defaultStore.snapshot();
    defaultStore.close();
    const customStore = createStore(custom);
    customStore.createProject("Custom Project");
    const customSnapshot = customStore.snapshot();
    customStore.close();

    async function readFromStartedApi(database: string) {
      const reserved = await reservePort();
      await new Promise<void>((resolve, reject) =>
        reserved.server.close((error) => (error ? reject(error) : resolve())),
      );
      const child = spawn(process.execPath, ["api/server.ts"], {
        cwd: fixture,
        env: {
          ...process.env,
          JIRA_TEST_MODE: "0",
          JIRA_DB_PATH: database,
          JIRA_API_PORT: String(reserved.port),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (child.exitCode !== null) throw new Error(output);
          try {
            const response = await fetch(
              `http://127.0.0.1:${reserved.port}/api/state`,
            );
            if (response.ok) return await response.json();
          } catch (error) {
            if (!(error instanceof TypeError)) throw error;
          }
          await delay(50);
        }
        throw new Error(`API did not start:\n${output}`);
      } finally {
        if (child.exitCode === null) {
          child.kill("SIGTERM");
          await once(child, "close");
        }
      }
    }

    try {
      assert.deepEqual(await readFromStartedApi(""), defaultSnapshot);
      assert.deepEqual(await readFromStartedApi(custom), customSnapshot);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);

test("refuses a persistent database in test mode", async () => {
  const fixture = copyApiFixture();
  const database = join(fixture, "must-not-be-created.sqlite");
  const child = spawn(process.execPath, ["api/server.ts"], {
    cwd: fixture,
    env: {
      ...process.env,
      JIRA_TEST_MODE: "1",
      JIRA_DB_PATH: database,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let errors = "";
  child.stderr.on("data", (chunk: Buffer) => (errors += chunk.toString()));

  try {
    const [code] = await once(child, "close");
    assert.notEqual(code, 0);
    assert.match(errors, /Test mode requires an in-memory database/);
    assert.equal(existsSync(database), false);
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "close");
    }
    rmSync(fixture, { recursive: true, force: true });
  }
});

async function isListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

for (const occupiedService of ["API", "Vite"] as const) {
  test(
    `stops both services when ${occupiedService} cannot start`,
    { timeout: 15_000 },
    async () => {
      const occupied = await reservePort();
      const available = await reservePort();

      await new Promise<void>((resolve, reject) => {
        available.server.close((error) => (error ? reject(error) : resolve()));
      });

      const apiPort =
        occupiedService === "API" ? occupied.port : available.port;
      const vitePort =
        occupiedService === "Vite" ? occupied.port : available.port;
      const npm = process.env.npm_execpath;

      assert.ok(npm, "Run this test using npm run test:startup.");

      const child = spawn(
        process.execPath,
        [npm, "run", "start", "--", "--port", String(vitePort), "--strictPort"],
        {
          env: {
            ...process.env,
            JIRA_TEST_MODE: "1",
            JIRA_DB_PATH: ":memory:",
            JIRA_API_PORT: String(apiPort),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";

      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      try {
        const [code] = await once(child, "close");

        assert.notEqual(code, 0, output);
        assert.match(output, /EADDRINUSE|already in use/, output);
        assert.equal(await isListening(available.port), false, output);
      } finally {
        await new Promise<void>((resolve, reject) => {
          occupied.server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );
}
