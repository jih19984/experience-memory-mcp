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
    title: "Google Drive 연결",
    description: "현재 사용자의 Google Drive를 연결할 수 있는 인증 URL을 생성합니다.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "saveExperienceMemory",
    title: "경험 기억 저장",
    description: "사진, 메모, 또는 사진과 메모를 하나의 경험 기억으로 저장합니다. 호출한 LLM이 정리한 제목, 요약, 태그, 감정을 함께 저장합니다.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: "searchExperienceMemories",
    title: "경험 기억 검색",
    description: "저장된 경험 기억을 자연어, 날짜, 태그, 감정 조건으로 검색합니다.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "updateExperienceMemory",
    title: "경험 기억 수정",
    description: "저장된 경험 기억의 제목, 요약, 태그, 감정 등 메타데이터를 수정하고 Markdown 노트를 다시 생성합니다. 원본 사진은 교체하지 않습니다.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "deleteExperienceMemory",
    title: "경험 기억 삭제",
    description: "저장된 경험 기억 하나와 연결된 Google Drive 사진 및 Markdown 노트 파일을 삭제합니다.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  {
    name: "debugRequestContext",
    title: "요청 인증 진단",
    description: "PlayMCP가 OAuth 인증 정보를 MCP 서버로 전달하는지 확인하기 위해 민감하지 않은 요청 정보만 점검합니다.",
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
