import { McpServer, type ServerContext } from "@modelcontextprotocol/server";
import { saveExperienceMemoryInputSchema } from "../tools/saveExperienceMemory.js";
import { searchExperienceMemoriesInputSchema } from "../tools/searchExperienceMemories.js";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";
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
    name: "saveExperienceMemory",
    title: "Save Experience Memory",
    description: "Save a photo-backed memory after the calling LLM has prepared title, summary, tags, and mood."
  },
  {
    name: "searchExperienceMemories",
    title: "Search Experience Memories",
    description: "Search saved experience memories with natural language, date, tag, and mood filters."
  }
] as const;

export interface ExperienceMemoryServerOptions {
  getService?: (ctx: ServerContext) => Promise<ExperienceMemoryService>;
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
    "saveExperienceMemory",
    {
      title: experienceMemoryToolDefinitions[0].title,
      description: experienceMemoryToolDefinitions[0].description,
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
      title: experienceMemoryToolDefinitions[1].title,
      description: experienceMemoryToolDefinitions[1].description,
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
