import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createJiraClient } from "./jira/client.ts";
import { registerCompleteTool, registerReadTools } from "./tools/issues.ts";
import { registerEvidenceTools } from "./tools/evidence.ts";

export function createMcpServer(apiPort: number): McpServer {
  const server = new McpServer({ name: "jira-simulator", version: "0.1.0" });
  const request = createJiraClient(apiPort);

  // Expose only issue reads, evidence updates and the completion transition.
  registerReadTools(server, request);
  registerEvidenceTools(server, request);
  registerCompleteTool(server, request);
  return server;
}
