import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createExperienceMemoryServer } from "../mcp/server.js";
import { getConfiguredExperienceMemoryService, type ExperienceActor } from "../services/configuredService.js";
import { PostgresGoogleConnectionRepository } from "../services/googleConnections.js";
import {
  createExperienceMemoryRootFolder,
  DEFAULT_GOOGLE_REDIRECT_URI,
  exchangeGoogleAuthCode,
  verifyGoogleOAuthState
} from "../services/googleOAuth.js";

export interface HttpServerConfig {
  port: number;
  host: string;
  mcpPath: string;
  healthPath: string;
  googleOAuthCallbackPath: string;
  actorProvider: string;
  actorHeaderNames: string[];
}

const DEFAULT_ACTOR_HEADERS = ["x-playmcp-user-id", "x-kakao-user-id", "x-mcp-user-id", "x-user-id", "mcp-user-id"];

export function resolveHttpServerConfig(env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  return {
    port: parsePort(env.PORT ?? env.MCP_HTTP_PORT, 8000),
    host: env.HOST ?? "0.0.0.0",
    mcpPath: normalizePath(env.MCP_HTTP_PATH ?? "/mcp"),
    healthPath: normalizePath(env.HEALTH_PATH ?? "/healthz"),
    googleOAuthCallbackPath: normalizePath(env.GOOGLE_OAUTH_CALLBACK_PATH ?? "/oauth/google/callback"),
    actorProvider: env.EXPERIENCE_MEMORY_ACTOR_PROVIDER ?? "kakao",
    actorHeaderNames: resolveActorHeaderNames(env)
  };
}

export function createHealthResponse(): Response {
  return Response.json({
    ok: true,
    service: "experience-memory-mcp"
  });
}

export function shouldHandleMcpRequest(request: Request, config: Pick<HttpServerConfig, "mcpPath">): boolean {
  const pathname = new URL(request.url).pathname;
  return pathname === config.mcpPath || (pathname === "/" && request.method !== "GET" && request.method !== "HEAD");
}

export function extractActorFromRequest(
  request: Request,
  config: Pick<HttpServerConfig, "actorProvider" | "actorHeaderNames">
): ExperienceActor | undefined {
  for (const headerName of config.actorHeaderNames) {
    const value = request.headers.get(headerName)?.trim();
    if (value) {
      return {
        provider: config.actorProvider,
        providerUserId: value
      };
    }
  }
  return undefined;
}

export async function startHttpServer(config: HttpServerConfig = resolveHttpServerConfig()): Promise<void> {
  const mcpHandler = createMcpHandler((ctx) => {
    const actor = ctx.requestInfo ? extractActorFromRequest(ctx.requestInfo, config) : undefined;
    const googleOAuthRedirectUri = ctx.requestInfo ? buildGoogleOAuthRedirectUri(ctx.requestInfo, config) : undefined;
    return createExperienceMemoryServer({
      getActor: () => actor,
      getGoogleOAuthRedirectUri: () => googleOAuthRedirectUri,
      getService: () => getConfiguredExperienceMemoryService({ actor })
    });
  });

  const server = createServer(async (nodeRequest, nodeResponse) => {
    try {
      const request = toWebRequest(nodeRequest);
      const pathname = new URL(request.url).pathname;
      if (pathname === config.healthPath || (pathname === "/" && (request.method === "GET" || request.method === "HEAD"))) {
        await writeWebResponse(nodeResponse, createHealthResponse());
        return;
      }
      if (pathname === config.googleOAuthCallbackPath) {
        await writeWebResponse(nodeResponse, await handleGoogleOAuthCallback(request));
        return;
      }
      if (shouldHandleMcpRequest(request, config)) {
        await writeWebResponse(nodeResponse, await mcpHandler.fetch(request));
        return;
      }
      await writeWebResponse(nodeResponse, Response.json({ error: "Not found" }, { status: 404 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeWebResponse(nodeResponse, Response.json({ error: message }, { status: 500 }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(config.port, config.host, resolve);
  });

  console.error(`Experience Memory MCP listening on http://${config.host}:${config.port}${config.mcpPath}`);
}

function buildGoogleOAuthRedirectUri(
  request: Request,
  config: Pick<HttpServerConfig, "googleOAuthCallbackPath">
): string {
  const url = new URL(request.url);
  return `${url.origin}${config.googleOAuthCallbackPath}`;
}

export async function handleGoogleOAuthCallback(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");
  if (error) {
    return htmlResponse(`Google OAuth failed: ${escapeHtml(error)}`, 400);
  }
  const code = requestUrl.searchParams.get("code");
  const stateValue = requestUrl.searchParams.get("state");
  if (!code || !stateValue) {
    return htmlResponse("Google OAuth callback is missing code or state.", 400);
  }
  const actor = verifyGoogleOAuthState(stateValue);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlResponse("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.", 500);
  }
  const redirectUri = actor.redirectUri ?? process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_GOOGLE_REDIRECT_URI;
  const tokens = await exchangeGoogleAuthCode({ clientId, clientSecret, redirectUri }, code);
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    return htmlResponse("Google did not return a refresh token. Revoke app access and try again.", 400);
  }
  const rootFolder = await createExperienceMemoryRootFolder({ clientId, clientSecret, redirectUri, refreshToken });
  const connections = new PostgresGoogleConnectionRepository();
  await connections.upsertConnection({
    provider: actor.provider,
    providerUserId: actor.providerUserId,
    refreshToken,
    driveRootFolderId: rootFolder.folderId
  });
  return htmlResponse("Experience Memory MCP connected. You can return to the chat and save memories now.", 200);
}

function resolveActorHeaderNames(env: NodeJS.ProcessEnv): string[] {
  const configured = env.EXPERIENCE_MEMORY_ACTOR_HEADER?.split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ACTOR_HEADERS;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function toWebRequest(nodeRequest: IncomingMessage): Request {
  const protocol = nodeRequest.headers["x-forwarded-proto"]?.toString() ?? "http";
  const host = nodeRequest.headers.host ?? "localhost";
  const url = `${protocol}://${host}${nodeRequest.url ?? "/"}`;
  const method = nodeRequest.method ?? "GET";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: toWebHeaders(nodeRequest.headers)
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = nodeRequest as unknown as BodyInit;
    init.duplex = "half";
  }
  return new Request(url, init);
}

function toWebHeaders(headers: IncomingHttpHeaders): Headers {
  const webHeaders = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        webHeaders.append(name, item);
      }
    } else if (value !== undefined) {
      webHeaders.set(name, value);
    }
  }
  return webHeaders;
}

async function writeWebResponse(nodeResponse: ServerResponse, response: Response): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  if (!response.body) {
    nodeResponse.end();
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    nodeResponse.write(Buffer.from(value));
  }
  nodeResponse.end();
}

function htmlResponse(message: string, status: number): Response {
  return new Response(`<!doctype html><html><body><h1>${message}</h1></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
