import { describe, expect, it } from "vitest";
import {
  getExperienceMemoryToolDefinitions,
  shouldExposeDebugRequestContext,
  shouldExposeManualDriveConnect,
  experienceMemoryToolDefinitions
} from "../src/mcp/server.js";

describe("Experience Memory MCP server", () => {
  it("hides manual Drive connection by default for PlayMCP OAuth", () => {
    expect(getExperienceMemoryToolDefinitions({}).map((tool) => tool.name)).toEqual([
      "saveExperienceMemory",
      "searchExperienceMemories",
      "updateExperienceMemory",
      "deleteExperienceMemory"
    ]);
    expect(
      getExperienceMemoryToolDefinitions({}).find((tool) => tool.name === "searchExperienceMemories")?.annotations.readOnlyHint
    ).toBe(true);
    expect(getExperienceMemoryToolDefinitions({}).find((tool) => tool.name === "deleteExperienceMemory")?.annotations.destructiveHint).toBe(
      true
    );
  });

  it("can expose manual Drive connection for non-PlayMCP fallback hosts", () => {
    expect(shouldExposeManualDriveConnect({ EXPERIENCE_MEMORY_ENABLE_MANUAL_DRIVE_CONNECT: "true" })).toBe(true);
    expect(
      getExperienceMemoryToolDefinitions({ EXPERIENCE_MEMORY_ENABLE_MANUAL_DRIVE_CONNECT: "true" }).map((tool) => tool.name)
    ).toEqual([
      "connectGoogleDrive",
      "saveExperienceMemory",
      "searchExperienceMemories",
      "updateExperienceMemory",
      "deleteExperienceMemory"
    ]);
  });

  it("can expose request context diagnostics only when explicitly enabled", () => {
    expect(shouldExposeDebugRequestContext({})).toBe(false);
    expect(shouldExposeDebugRequestContext({ EXPERIENCE_MEMORY_ENABLE_DEBUG_CONTEXT: "true" })).toBe(true);
    expect(getExperienceMemoryToolDefinitions({ EXPERIENCE_MEMORY_ENABLE_DEBUG_CONTEXT: "true" }).map((tool) => tool.name)).toEqual([
      "saveExperienceMemory",
      "searchExperienceMemories",
      "updateExperienceMemory",
      "deleteExperienceMemory",
      "debugRequestContext"
    ]);
  });

  it("keeps the complete internal tool definition list available", () => {
    expect(experienceMemoryToolDefinitions.find((tool) => tool.name === "connectGoogleDrive")?.annotations.openWorldHint).toBe(
      true
    );
  });

  it("keeps PlayMCP tool metadata contest-ready", () => {
    for (const tool of getExperienceMemoryToolDefinitions({})) {
      expect(tool.annotations.title).toBe(tool.title);
      expect(tool.description).toContain("기억메모리 Ver 2");
      expect(tool.description.length).toBeLessThanOrEqual(1024);
    }
  });
});
