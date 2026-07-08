import { describe, expect, it } from "vitest";
import { assertDatabaseUrl, loadDatabaseSchema } from "../src/services/databaseSetup.js";

describe("database setup helpers", () => {
  it("loads the PostgreSQL schema used by the MCP", async () => {
    const schema = await loadDatabaseSchema();

    expect(schema).toContain("CREATE TABLE IF NOT EXISTS experience_memories");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS experience_memories_text_idx");
  });

  it("requires DATABASE_URL before running database commands", () => {
    expect(() => assertDatabaseUrl(undefined)).toThrow("DATABASE_URL is required");
  });
});
