import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createExperienceMemoryServer } from "../mcp/server.js";
import { getConfiguredExperienceMemoryService, type ExperienceActor } from "../services/configuredService.js";

export interface HttpServerConfig {
  port: number;
  host: string;
  mcpPath: string;
  healthPath: string;
  actorProvider: string;
  actorHeaderNames: string[];
}

const DEFAULT_ACTOR_HEADERS = ["x-playmcp-user-id", "x-kakao-user-id", "x-mcp-user-id", "x-user-id", "mcp-user-id"];

export function resolveHttpServerConfig(env: NodeJS.ProcessEnv = process.env): HttpServerConfig {
  return {
    port: parsePort(env.PORT ?? env.MCP_HTTP_PORT, 3000),
    host: env.HOST ?? "0.0.0.0",
    mcpPath: normalizePath(env.MCP_HTTP_PATH ?? "/mcp"),
    healthPath: normalizePath(env.HEALTH_PATH ?? "/healthz"),
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
  return new URL(request.url).pathname === config.mcpPath;
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
    return createExperienceMemoryServer({
      getService: () => getConfiguredExperienceMemoryService({ actor })
    });
  });

  const server = createServer(async (nodeRequest, nodeResponse) => {
    try {
      const request = toWebRequest(nodeRequest);
      const pathname = new URL(request.url).pathname;
      if (pathname === config.healthPath) {
        await writeWebResponse(nodeResponse, createHealthResponse());
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
