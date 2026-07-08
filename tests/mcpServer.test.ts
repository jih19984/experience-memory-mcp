import { describe, expect, it } from "vitest";
import { experienceMemoryToolDefinitions } from "../src/mcp/server.js";

describe("Experience Memory MCP server", () => {
  it("exposes only save and search tools for the MVP", () => {
    expect(experienceMemoryToolDefinitions.map((tool) => tool.name)).toEqual([
      "connectGoogleDrive",
      "saveExperienceMemory",
      "searchExperienceMemories"
    ]);
  });
});
