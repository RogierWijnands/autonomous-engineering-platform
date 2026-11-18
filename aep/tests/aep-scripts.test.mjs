import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test(
  "startup and migration scripts use the relocated project and root environment",
  { skip: process.platform === "win32" },
  () => {
    const npm = process.env.npm_execpath;
    assert.ok(npm, "Run this test using npm run test:dev.");
    const fixture = realpathSync(mkdtempSync(join(tmpdir(), "aep-scripts-")));

    try {
      const bin = join(fixture, "node_modules/.bin");
      mkdirSync(bin, { recursive: true });
      mkdirSync(join(fixture, "aep"));
      copyFileSync(join(root, "package.json"), join(fixture, "package.json"));
      writeFileSync(join(fixture, ".env"), "AEP_SCRIPT_TEST_VALUE=present\n");
      symlinkSync(join(root, "node_modules/.bin/dotenv"), join(bin, "dotenv"));
      const dotnet = join(bin, "dotnet");
      writeFileSync(
        dotnet,
        `#!/usr/bin/env node
console.log("AEP_SCRIPT_RESULT:" + JSON.stringify({
  cwd: process.cwd(),
  args: process.argv.slice(2),
  value: process.env.AEP_SCRIPT_TEST_VALUE,
}));
`,
      );
      chmodSync(dotnet, 0o755);
      const npmStub = join(bin, "npm");
      writeFileSync(
        npmStub,
        `#!/usr/bin/env node
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["run", "db:up"])) {
  process.exit(1);
}
`,
      );
      chmodSync(npmStub, 0o755);
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
      delete env.AEP_SCRIPT_TEST_VALUE;

      for (const [script, cwd, args] of [
        ["startup", fixture, ["run", "--project", "aep/src/Aep/Aep.csproj"]],
        [
          "db:migrate",
          join(fixture, "aep"),
          [
            "ef",
            "database",
            "update",
            "--project",
            "src/Aep/Aep.csproj",
            "--startup-project",
            "src/Aep/Aep.csproj",
          ],
        ],
      ]) {
        const result = spawnSync(process.execPath, [npm, "run", script], {
          cwd: fixture,
          env,
          encoding: "utf8",
          timeout: 10_000,
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
        const match = result.stdout.match(/AEP_SCRIPT_RESULT:(\{[^\n]+\})/);
        assert.ok(match, result.stdout);
        assert.deepEqual(JSON.parse(match[1]), { cwd, args, value: "present" });
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);
