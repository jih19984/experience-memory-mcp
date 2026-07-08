#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { startHttpServer } from "./http/server.js";
import { createExperienceMemoryServer } from "./mcp/server.js";

async function main() {
  if ((process.env.MCP_TRANSPORT ?? "http") === "http") {
    await startHttpServer();
    return;
  }

  const server = createExperienceMemoryServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
