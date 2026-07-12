import { describe, expect, it } from "vitest";
import {
  getExperienceMemoryToolDefinitions,
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

  it("keeps the complete internal tool definition list available", () => {
    expect(experienceMemoryToolDefinitions.find((tool) => tool.name === "connectGoogleDrive")?.annotations.openWorldHint).toBe(
      true
    );
  });
});
