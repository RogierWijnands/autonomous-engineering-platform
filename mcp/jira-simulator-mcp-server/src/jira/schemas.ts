import { z } from "zod";

// Validate the fields the adapter uses while retaining other issue data.
const issueSchema = z
  .object({
    key: z.string(),
    projectId: z.string(),
    summary: z.string(),
    status: z.string(),
  })
  .passthrough();

export const stateSchema = z.object({
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      repository: z.string().optional(),
    }),
  ),
  issues: z.array(issueSchema),
});
export const singleIssueSchema = z.object({ issue: issueSchema });
// The simulator performs the full evidence and image validation before storage.
export const evidenceSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.unknown()),
  })
  .strict();
export const keySchema = z
  .string()
  .min(1)
  .max(100)
  .describe("Issue key, for example DEMO-1001.");
