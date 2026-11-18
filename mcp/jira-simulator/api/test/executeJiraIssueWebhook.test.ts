import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "../app.ts";
import { createExecuteJiraIssueWebhook } from "../webhooks/executeJiraIssueWebhook.ts";
import { createStore } from "../database/store.ts";
import { initialIssues } from "../../src/test/fixtures/issues.ts";
import { initialProjects } from "../../src/test/fixtures/projects.ts";

test("execution webhook accepts only a credential-free local HTTP endpoint", () => {
  for (const url of [
    "not a url",
    "https://127.0.0.1:5062/webhook",
    "http://example.com/webhook",
    "http://127.0.0.2/webhook",
    "http://user:password@127.0.0.1/webhook",
    "http://127.0.0.1/webhook?token=example",
    "http://127.0.0.1/webhook#fragment",
  ]) {
    assert.throws(
      () => createExecuteJiraIssueWebhook(url),
      /^Error: Invalid execution webhook configuration\.$/,
    );
  }
  assert.doesNotThrow(() =>
    createExecuteJiraIssueWebhook("http://127.0.0.1:5062/webhook"),
  );
});

test("execution requests send distinct minimal events and report uncertain delivery", async () => {
  const received: { method?: string; path?: string; body: string }[] = [];
  let mode: "accept" | "reject" | "redirect" | "disconnect" | "hang" = "accept";
  const receiver = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      received.push({ method: req.method, path: req.url, body });
      if (mode === "disconnect") return req.socket.destroy();
      if (mode === "hang") return;
      if (mode === "redirect") {
        res.writeHead(307, { Location: "/redirect-target" });
      } else {
        res.writeHead(mode === "accept" ? 202 : 500);
      }
      res.end();
    });
  }).listen(0, "127.0.0.1");
  await once(receiver, "listening");
  const receiverAddress = receiver.address();
  assert.ok(receiverAddress && typeof receiverAddress !== "string");

  const probe = createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  const apiAddress = probe.address();
  assert.ok(apiAddress && typeof apiAddress !== "string");
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  const store = createStore(":memory:");
  store.resetTestData({ projects: initialProjects, issues: initialIssues });
  const before = store.snapshot();
  const server = createServer(
    createApp(
      apiAddress.port,
      store,
      `http://127.0.0.1:${receiverAddress.port}/webhook`,
    ),
  ).listen(apiAddress.port, "127.0.0.1");
  await once(server, "listening");
  const post = (body: object, origin?: string) =>
    fetch(`http://127.0.0.1:${apiAddress.port}/api/issues/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    });

  try {
    assert.equal((await post({ key: "MISSING-123" })).status, 404);
    assert.equal((await post({ key: 123 })).status, 400);
    assert.equal(
      (await post({ key: "DEMO-1001" }, "https://example.com")).status,
      403,
    );
    assert.equal(received.length, 0);

    for (let index = 0; index < 2; index++) {
      const response = await post({ key: "DEMO-1001" });
      assert.equal(response.status, 202);
      assert.deepEqual(await response.json(), { delivered: true });
    }
    assert.equal(received.length, 2);
    const events = received.map(({ method, path, body }) => {
      assert.equal(method, "POST");
      assert.equal(path, "/webhook");
      return JSON.parse(body);
    });
    for (const event of events) {
      assert.deepEqual(Object.keys(event).sort(), [
        "event",
        "eventId",
        "issueKey",
      ]);
      assert.equal(event.event, "issue.execution_requested");
      assert.equal(event.issueKey, "DEMO-1001");
      assert.match(event.eventId, /^[0-9a-f-]{36}$/);
    }
    assert.notEqual(events[0].eventId, events[1].eventId);

    for (const failure of [
      "reject",
      "redirect",
      "disconnect",
      "hang",
    ] as const) {
      mode = failure;
      const previousCount: number = received.length;
      const started = Date.now();
      const response = await post({ key: "DEMO-1001" });
      if (failure === "hang") {
        assert.ok(Date.now() - started >= 9_000);
        assert.ok(Date.now() - started < 20_000);
      }
      assert.equal(response.status, 502);
      assert.match(
        (await response.json()).error,
        /may have started.*before trying again/i,
      );
      assert.equal(received.length, previousCount + 1);
      assert.equal(received.at(-1)?.path, "/webhook");
    }
    assert.deepEqual(store.snapshot(), before);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    store.close();
    await new Promise<void>((resolve, reject) =>
      receiver.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
