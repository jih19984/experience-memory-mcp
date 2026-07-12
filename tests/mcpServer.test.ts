import { describe, expect, it } from "vitest";
import { experienceMemoryToolDefinitions } from "../src/mcp/server.js";

describe("Experience Memory MCP server", () => {
  it("exposes CRUD memory tools with risk annotations", () => {
    expect(experienceMemoryToolDefinitions.map((tool) => tool.name)).toEqual([
      "connectGoogleDrive",
      "saveExperienceMemory",
      "searchExperienceMemories",
      "updateExperienceMemory",
      "deleteExperienceMemory"
    ]);
    expect(experienceMemoryToolDefinitions.find((tool) => tool.name === "searchExperienceMemories")?.annotations.readOnlyHint).toBe(
      true
    );
    expect(experienceMemoryToolDefinitions.find((tool) => tool.name === "deleteExperienceMemory")?.annotations.destructiveHint).toBe(
      true
    );
  });
});
