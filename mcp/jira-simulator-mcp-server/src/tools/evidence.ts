import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClient } from "../jira/client.ts";
import {
  evidenceSchema,
  keySchema,
  singleIssueSchema,
} from "../jira/schemas.ts";
import { runTool } from "./toolRunner.ts";

export function registerEvidenceTools(server: McpServer, request: JiraClient) {
  // The expected document prevents replacing a concurrent evidence update.
  server.registerTool(
    "update_evidence",
    {
      description:
        "Replace only issue evidence. Supply the evidence read from get_issue as expected (null if absent) to prevent overwriting concurrent changes. The document is {type:'doc',content:[...]} with paragraph, bulletList, listItem, hardBreak, text (bold/italic marks), or image nodes. Image attrs require a base64 data URL for static PNG, JPEG or WebP; alt is optional and recommended for accessibility. Maximum three images, 512 KB and 4096x4096 pixels each. No links or external URLs.",
      inputSchema: {
        key: keySchema,
        expected: evidenceSchema.nullable(),
        evidence: evidenceSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    ({ key, expected, evidence }) =>
      runTool(async () => {
        return (
          await request("issues/evidence?response=issue", singleIssueSchema, {
            key,
            expected,
            evidence,
          })
        ).issue;
      }),
  );
}
