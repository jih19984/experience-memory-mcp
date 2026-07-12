import { McpServer, type ServerContext } from "@modelcontextprotocol/server";
import { connectGoogleDrive, connectGoogleDriveInputSchema } from "../tools/connectGoogleDrive.js";
import { deleteExperienceMemoryInputSchema } from "../tools/deleteExperienceMemory.js";
import { saveExperienceMemoryInputSchema } from "../tools/saveExperienceMemory.js";
import { searchExperienceMemoriesInputSchema } from "../tools/searchExperienceMemories.js";
import { updateExperienceMemoryInputSchema } from "../tools/updateExperienceMemory.js";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";
import type { ExperienceActor } from "../services/configuredService.js";
import type { ExperienceMemoryService } from "../services/memoryService.js";

function jsonResponse(output: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    structuredContent: output
  };
}

function errorResponse(error: unknown) {
  const message = safeErrorMessage(error);
  return {
    ...jsonResponse({ error: message }),
    isError: true
  };
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Google Drive authentication is missing/i.test(message)) {
    return "Google Drive authentication is missing. Please connect Google OAuth in PlayMCP and retry.";
  }
  if (/Request is missing required authentication credential/i.test(message)) {
    return "Google authentication failed. Please reconnect Google Drive and retry.";
  }
  if (/Google Drive is not connected/i.test(message)) {
    return "Google Drive is not connected for this user. Please connect Google Drive first.";
  }
  if (/Missing Google Drive configuration/i.test(message)) {
    return "Google Drive configuration is missing. Please check OAuth settings.";
  }
  return message.replace(/https?:\/\/\S+/g, "[link removed]");
}

export const experienceMemoryToolDefinitions = [
  {
    name: "connectGoogleDrive",
    title: "Google Drive 연결",
    description:
      "Creates a Google Drive connection URL for Experience Memory MCP(기억주머니). Use only when the MCP host does not provide PlayMCP OAuth.",
    annotations: {
      title: "Google Drive 연결",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "saveExperienceMemory",
    title: "경험 기억 저장",
    description:
      "Stores a photo, text note, or both as a personal memory in Experience Memory MCP(기억주머니). The calling LLM provides the title, summary, tags, and mood.",
    annotations: {
      title: "경험 기억 저장",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "searchExperienceMemories",
    title: "경험 기억 검색",
    description:
      "Searches saved personal memories in Experience Memory MCP(기억주머니) by natural language, date range, tags, and mood.",
    annotations: {
      title: "경험 기억 검색",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "updateExperienceMemory",
    title: "경험 기억 수정",
    description:
      "Updates the title, summary, note, tags, mood, date, activity, or location of a memory in Experience Memory MCP(기억주머니). The original photo is not replaced.",
    annotations: {
      title: "경험 기억 수정",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "deleteExperienceMemory",
    title: "경험 기억 삭제",
    description:
      "Deletes one saved memory from Experience Memory MCP(기억주머니), including linked Google Drive photo and Markdown note files when present.",
    annotations: {
      title: "경험 기억 삭제",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "debugRequestContext",
    title: "요청 인증 진단",
    description:
      "Checks non-sensitive request authentication diagnostics for Experience Memory MCP(기억주머니). Enable only during PlayMCP OAuth troubleshooting.",
    annotations: {
      title: "요청 인증 진단",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }
] as const;

export function shouldExposeManualDriveConnect(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.EXPERIENCE_MEMORY_ENABLE_MANUAL_DRIVE_CONNECT === "true";
}

export function getExperienceMemoryToolDefinitions(env: NodeJS.ProcessEnv = process.env) {
  return experienceMemoryToolDefinitions.filter((tool) => {
    if (tool.name === "connectGoogleDrive") {
      return shouldExposeManualDriveConnect(env);
    }
    if (tool.name === "debugRequestContext") {
      return shouldExposeDebugRequestContext(env);
    }
    return true;
  });
}

export function shouldExposeDebugRequestContext(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.EXPERIENCE_MEMORY_ENABLE_DEBUG_CONTEXT === "true";
}

export interface ExperienceMemoryServerOptions {
  getService?: (ctx: ServerContext) => Promise<ExperienceMemoryService>;
  getActor?: (ctx: ServerContext) => ExperienceActor | undefined;
  getGoogleOAuthRedirectUri?: () => string | undefined;
  getRequestDiagnostics?: () => unknown;
  exposeManualDriveConnect?: boolean;
  exposeDebugRequestContext?: boolean;
}

export function createExperienceMemoryServer(options: ExperienceMemoryServerOptions = {}): McpServer {
  const getService = options.getService ?? (() => getConfiguredExperienceMemoryService());
  const server = new McpServer(
    {
      name: "experience-memory-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  if (options.exposeManualDriveConnect ?? shouldExposeManualDriveConnect()) {
    server.registerTool(
      "connectGoogleDrive",
      {
        title: experienceMemoryToolDefinitions[0].title,
        description: experienceMemoryToolDefinitions[0].description,
        annotations: experienceMemoryToolDefinitions[0].annotations,
        inputSchema: connectGoogleDriveInputSchema
      },
      async (input, ctx) => {
        try {
          return jsonResponse(
            await connectGoogleDrive(input, {
              actor: options.getActor?.(ctx),
              redirectUri: options.getGoogleOAuthRedirectUri?.()
            })
          );
        } catch (error) {
          return errorResponse(error);
        }
      }
    );
  }

  server.registerTool(
    "saveExperienceMemory",
    {
      title: experienceMemoryToolDefinitions[1].title,
      description: experienceMemoryToolDefinitions[1].description,
      annotations: experienceMemoryToolDefinitions[1].annotations,
      inputSchema: saveExperienceMemoryInputSchema
    },
    async (input, ctx) => {
      try {
        return jsonResponse(await (await getService(ctx)).saveExperienceMemory(input));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "searchExperienceMemories",
    {
      title: experienceMemoryToolDefinitions[2].title,
      description: experienceMemoryToolDefinitions[2].description,
      annotations: experienceMemoryToolDefinitions[2].annotations,
      inputSchema: searchExperienceMemoriesInputSchema
    },
    async (input, ctx) => {
      try {
        return jsonResponse(await (await getService(ctx)).searchExperienceMemories(input));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "updateExperienceMemory",
    {
      title: experienceMemoryToolDefinitions[3].title,
      description: experienceMemoryToolDefinitions[3].description,
      annotations: experienceMemoryToolDefinitions[3].annotations,
      inputSchema: updateExperienceMemoryInputSchema
    },
    async (input, ctx) => {
      try {
        return jsonResponse(await (await getService(ctx)).updateExperienceMemory(input));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  server.registerTool(
    "deleteExperienceMemory",
    {
      title: experienceMemoryToolDefinitions[4].title,
      description: experienceMemoryToolDefinitions[4].description,
      annotations: experienceMemoryToolDefinitions[4].annotations,
      inputSchema: deleteExperienceMemoryInputSchema
    },
    async (input, ctx) => {
      try {
        return jsonResponse(await (await getService(ctx)).deleteExperienceMemory(input));
      } catch (error) {
        return errorResponse(error);
      }
    }
  );

  if (options.exposeDebugRequestContext ?? shouldExposeDebugRequestContext()) {
    server.registerTool(
      "debugRequestContext",
      {
        title: experienceMemoryToolDefinitions[5].title,
        description: experienceMemoryToolDefinitions[5].description,
        annotations: experienceMemoryToolDefinitions[5].annotations,
        inputSchema: {}
      },
      async (_input, ctx) => {
        try {
          return jsonResponse(options.getRequestDiagnostics?.() ?? { error: "Request diagnostics are unavailable for this transport." });
        } catch (error) {
          return errorResponse(error);
        }
      }
    );
  }

  return server;
}
