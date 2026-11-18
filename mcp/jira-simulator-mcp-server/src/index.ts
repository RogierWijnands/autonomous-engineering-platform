import { createHttpServer, parsePort } from "./server.ts";

// The MCP adapter and simulator API use separately configurable local ports.
const port = parsePort(process.env.JIRA_MCP_PORT, 3002);
const apiPort = parsePort(process.env.JIRA_API_PORT, 3001);
const server = createHttpServer(port, apiPort);

// Loopback limits network exposure but does not authenticate local clients.
server.listen(port, "127.0.0.1", () => {
  console.log(`Jira Simulator MCP listening on http://127.0.0.1:${port}/mcp`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
