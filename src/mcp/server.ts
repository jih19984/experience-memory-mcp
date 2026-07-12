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
  const message = error instanceof Error ? error.message : String(error);
  return {
    ...jsonResponse({ error: message }),
    isError: true
  };
}

export const experienceMemoryToolDefinitions = [
  {
    name: "connectGoogleDrive",
    title: "Connect Google Drive",
    description: "Return a Google OAuth URL so the current user can connect their own Google Drive.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "saveExperienceMemory",
    title: "Save Experience Memory",
    description: "Save a photo, a text note, or both after the calling LLM has prepared title, summary, tags, and mood.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "searchExperienceMemories",
    title: "Search Experience Memories",
    description: "Search saved experience memories with natural language, date, tag, and mood filters.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "updateExperienceMemory",
    title: "Update Experience Memory",
    description: "Update saved memory metadata and regenerate its Markdown note without replacing the original photo.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "deleteExperienceMemory",
    title: "Delete Experience Memory",
    description: "Delete one saved memory and its associated Google Drive photo and Markdown note files.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "debugRequestContext",
    title: "Debug Request Context",
    description: "Inspect non-secret request context fields to diagnose PlayMCP authentication forwarding.",
    annotations: {
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
