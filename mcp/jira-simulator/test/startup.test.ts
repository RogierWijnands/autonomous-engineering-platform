import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createConnection, createServer } from "node:net";
import { test } from "node:test";

async function reservePort() {
  const server = createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  assert.ok(address && typeof address !== "string");

  return { server, port: address.port };
}

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
