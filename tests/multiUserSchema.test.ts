import { describe, expect, it } from "vitest";
import { loadDatabaseSchema } from "../src/services/databaseSetup.js";

describe("multi-user database schema", () => {
  it("stores users, encrypted Google connections, and user-scoped memories", async () => {
    const schema = await loadDatabaseSchema();

    expect(schema).toContain("CREATE TABLE IF NOT EXISTS memory_users");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS google_connections");
    expect(schema).toContain("encrypted_refresh_token TEXT NOT NULL");
    expect(schema).toContain("user_id UUID REFERENCES memory_users(id)");
  });
});
