import { McpServer, type ServerContext } from "@modelcontextprotocol/server";
import { connectGoogleDrive, connectGoogleDriveInputSchema } from "../tools/connectGoogleDrive.js";
import { saveExperienceMemoryInputSchema } from "../tools/saveExperienceMemory.js";
import { searchExperienceMemoriesInputSchema } from "../tools/searchExperienceMemories.js";
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
  return jsonResponse({ error: message });
}

export const experienceMemoryToolDefinitions = [
  {
    name: "connectGoogleDrive",
    title: "Connect Google Drive",
    description: "Return a Google OAuth URL so the current user can connect their own Google Drive."
  },
  {
    name: "saveExperienceMemory",
    title: "Save Experience Memory",
    description: "Save a photo, a text note, or both after the calling LLM has prepared title, summary, tags, and mood."
  },
  {
    name: "searchExperienceMemories",
    title: "Search Experience Memories",
    description: "Search saved experience memories with natural language, date, tag, and mood filters."
  }
] as const;

export interface ExperienceMemoryServerOptions {
  getService?: (ctx: ServerContext) => Promise<ExperienceMemoryService>;
  getActor?: (ctx: ServerContext) => ExperienceActor | undefined;
  getGoogleOAuthRedirectUri?: () => string | undefined;
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

  server.registerTool(
    "connectGoogleDrive",
    {
      title: experienceMemoryToolDefinitions[0].title,
      description: experienceMemoryToolDefinitions[0].description,
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

  server.registerTool(
    "saveExperienceMemory",
    {
      title: experienceMemoryToolDefinitions[1].title,
      description: experienceMemoryToolDefinitions[1].description,
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

  return server;
}
