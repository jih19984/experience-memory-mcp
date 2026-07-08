import { describe, expect, it } from "vitest";
import {
  createHealthResponse,
  extractActorFromRequest,
  resolveHttpServerConfig,
  shouldHandleMcpRequest
} from "../src/http/server.js";

describe("HTTP MCP endpoint", () => {
  it("uses PlayMCP in KC's default container port and MCP path", () => {
    const config = resolveHttpServerConfig({});

    expect(config.port).toBe(8000);
    expect(config.mcpPath).toBe("/mcp");
    expect(config.healthPath).toBe("/healthz");
  });

  it("detects MCP requests only on the configured path", () => {
    const config = resolveHttpServerConfig({ MCP_HTTP_PATH: "/mcp" });

    expect(shouldHandleMcpRequest(new Request("http://localhost:3000/mcp", { method: "POST" }), config)).toBe(true);
    expect(shouldHandleMcpRequest(new Request("http://localhost:3000/", { method: "POST" }), config)).toBe(true);
    expect(shouldHandleMcpRequest(new Request("http://localhost:3000/healthz", { method: "GET" }), config)).toBe(false);
  });

  it("returns a JSON health response for cloud readiness checks", async () => {
    const response = createHealthResponse();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "experience-memory-mcp"
    });
  });

  it("extracts the actor from a configured HTTP header", () => {
    const request = new Request("http://localhost:3000/mcp", {
      headers: { "x-playmcp-user-id": "kakao-user-123" }
    });

    expect(
      extractActorFromRequest(request, {
        actorProvider: "kakao",
        actorHeaderNames: ["x-playmcp-user-id"]
      })
    ).toEqual({
      provider: "kakao",
      providerUserId: "kakao-user-123"
    });
  });
});
