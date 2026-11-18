import { createServer } from "node:http";
import express, { type ErrorRequestHandler, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcp.ts";

const MAX_REQUEST_BYTES = 5_005_000;

export function parsePort(
  value: string | undefined,
  defaultPort: number,
): number {
  if (value === undefined) return defaultPort;
  if (!/^[0-9]+$/.test(value)) throw new Error("Invalid port configuration.");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid port configuration.");
  }
  return port;
}

function sendError(res: Response, status: number, message: string) {
  res
    .set("Cache-Control", "no-store")
    .status(status)
    .json({
      jsonrpc: "2.0",
      error: { code: -32600, message },
      id: null,
    });
}

export function createHttpServer(port: number, apiPort: number) {
  const app = express();
  app.disable("x-powered-by");
  app.enable("case sensitive routing");
  app.enable("strict routing");

  // Restrict host, origin, method and endpoint before accepting a request body.
  app.use((req, res, next) => {
    if (req.headers.host !== `127.0.0.1:${port}` || req.headers.origin) {
      req.resume();
      return sendError(res, 403, "Invalid host or origin.");
    }
    if (req.url !== "/mcp" || req.method !== "POST") {
      req.resume();
      return sendError(res, 405, "Only POST /mcp is supported.");
    }
    if (req.headers["content-type"]?.split(";")[0] !== "application/json") {
      req.resume();
      return sendError(res, 415, "Expected JSON.");
    }
    if (Number(req.headers["content-length"]) > MAX_REQUEST_BYTES) {
      req.resume();
      return sendError(res, 413, "Request too large.");
    }
    next();
  });

  // Enforce the same byte limit for declared and streamed JSON bodies.
  app.use(
    express.json({
      limit: MAX_REQUEST_BYTES,
      strict: false,
      inflate: false,
      type: () => true,
      verify: (_req, _res, body) => {
        if (body.length === 0) throw new SyntaxError("Empty request.");
      },
    }),
  );
  // A stateless MCP transport is created and closed for each HTTP response.
  app.post("/mcp", async (req, res) => {
    if (req.body === undefined) {
      return sendError(res, 400, "Invalid or oversized JSON request.");
    }
    const server = createMcpServer(apiPort);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.once("close", () => {
      void server
        .close()
        .catch((error: unknown) =>
          console.error("MCP transport close failed:", error),
        );
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) sendError(res, 500, "MCP request failed.");
      else res.end();
    }
  });

  // Map parser failures to JSON-RPC errors; log unexpected server failures.
  const handleError: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      typeof error.type === "string" &&
      [
        "entity.too.large",
        "entity.parse.failed",
        "entity.verify.failed",
        "encoding.unsupported",
        "charset.unsupported",
      ].includes(error.type)
    ) {
      sendError(
        res,
        error.type === "entity.too.large" ? 413 : 400,
        "Invalid or oversized JSON request.",
      );
    } else {
      console.error("MCP request failed:", error);
      sendError(res, 500, "MCP request failed.");
    }
  };
  app.use(handleError);
  return createServer(app);
}
