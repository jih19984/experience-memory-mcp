import { describe, expect, it } from "vitest";
import {
  createHealthResponse,
  extractActorFromRequest,
  extractBearerTokenFromRequest,
  buildGoogleOAuthRedirectUri,
  buildRequestDiagnostics,
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

  it("uses a configured default actor when the MCP host does not send a user header", () => {
    const request = new Request("http://localhost:3000/mcp");

    expect(
      extractActorFromRequest(request, {
        actorProvider: "kakao",
        actorHeaderNames: ["x-playmcp-user-id"],
        defaultActorId: "playmcp-demo"
      })
    ).toEqual({
      provider: "kakao",
      providerUserId: "playmcp-demo"
    });
  });

  it("extracts an OAuth bearer token from the HTTP Authorization header", () => {
    const request = new Request("http://localhost:3000/mcp", {
      headers: { authorization: "Bearer google-access-token" }
    });

    expect(extractBearerTokenFromRequest(request)).toBe("google-access-token");
  });

  it("reports request auth diagnostics without exposing token values", () => {
    const diagnostics = buildRequestDiagnostics(
      new Request("http://localhost:3000/mcp", {
        headers: {
          authorization: "Bearer google-access-token",
          "x-forwarded-for": "127.0.0.1",
          "x-playmcp-user-id": "user-1"
        }
      })
    );

    expect(diagnostics.authHeaderPresent).toBe(true);
    expect(diagnostics.authHeaderScheme).toBe("Bearer");
    expect(diagnostics.authHeaderTokenLength).toBe("google-access-token".length);
    expect(JSON.stringify(diagnostics)).not.toContain("google-access-token");
    expect(diagnostics.relevantHeaderNames).toContain("authorization");
  });

  it("builds HTTPS Google OAuth callbacks for public cloud hosts", () => {
    const redirectUri = buildGoogleOAuthRedirectUri(new Request("http://experience-memory-mcp.playmcp-endpoint.kakaocloud.io/mcp"), {
      googleOAuthCallbackPath: "/oauth/google/callback"
    });

    expect(redirectUri).toBe("https://experience-memory-mcp.playmcp-endpoint.kakaocloud.io/oauth/google/callback");
  });

  it("keeps HTTP Google OAuth callbacks for localhost development", () => {
    const redirectUri = buildGoogleOAuthRedirectUri(new Request("http://localhost:8000/mcp"), {
      googleOAuthCallbackPath: "/oauth/google/callback"
    });

    expect(redirectUri).toBe("http://localhost:8000/oauth/google/callback");
  });
});
