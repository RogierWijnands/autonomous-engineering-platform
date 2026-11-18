import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test(
  "restarts AEP on source changes, ignores build output, and exits on failure",
  { timeout: 20_000, skip: process.platform === "win32" },
  async () => {
    const fixture = mkdtempSync(join(tmpdir(), "aep-dev-watch-"));
    let child;
    let output = "";

    try {
      mkdirSync(join(fixture, "aep/src/Aep/obj"), { recursive: true });
      mkdirSync(join(fixture, "bin"));
      symlinkSync(
        join(root, "node_modules"),
        join(fixture, "node_modules"),
        "dir",
      );
      writeFileSync(join(fixture, ".env"), "");
      const source = join(fixture, "aep/src/Aep/Probe.cs");
      writeFileSync(source, "first");
      const dotnet = join(fixture, "bin/dotnet");
      writeFileSync(
        dotnet,
        `#!/usr/bin/env node
const fs = require("node:fs");
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["run", "--project", "aep/src/Aep/Aep.csproj"])) {
  throw new Error("Unexpected AEP startup arguments");
}
const content = fs.readFileSync("aep/src/Aep/Probe.cs", "utf8");
if (content === "crash") process.exit(23);
console.log("AEP_PROBE:" + content);
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1000);
`,
      );
      chmodSync(dotnet, 0o755);
      const { scripts } = JSON.parse(
        readFileSync(join(root, "package.json"), "utf8"),
      );
      const args = [...scripts.dev.matchAll(/"([^"]*)"|(\S+)/g)].map(
        (match) => match[1] ?? match[2],
      );
      assert.equal(args.shift(), "nodemon");
      child = spawn(
        process.execPath,
        [join(root, "node_modules/nodemon/bin/nodemon.js"), ...args],
        {
          cwd: fixture,
          env: {
            ...process.env,
            PATH: `${join(fixture, "bin")}:${join(root, "node_modules/.bin")}:${process.env.PATH}`,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.stdout.on("data", (chunk) => (output += chunk.toString()));
      child.stderr.on("data", (chunk) => (output += chunk.toString()));
      const closed = once(child, "close");
      const waitFor = async (text) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (output.includes(text)) return;
          if (child.exitCode !== null) throw new Error(output);
          await delay(100);
        }
        throw new Error(`Missing ${text}:\n${output}`);
      };

      try {
        await waitFor("AEP_PROBE:first");
        writeFileSync(
          join(fixture, "aep/src/Aep/obj/generated.cs"),
          "generated",
        );
        await delay(700);
        assert.equal(
          (output.match(/AEP_PROBE:first/g) ?? []).length,
          1,
          output,
        );
        writeFileSync(source, "second");
        await waitFor("AEP_PROBE:second");
        writeFileSync(source, "crash");
        const [code] = await closed;
        assert.notEqual(code, 0, output);
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
          await closed;
        }
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);
