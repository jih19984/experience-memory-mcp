import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

export function assertDatabaseUrl(databaseUrl = process.env.DATABASE_URL): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

export async function loadDatabaseSchema(schemaPath = path.resolve("schema.sql")): Promise<string> {
  return readFile(schemaPath, "utf8");
}

export async function initializeDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  const client = new Client({ connectionString: assertDatabaseUrl(databaseUrl) });
  await client.connect();
  try {
    await client.query(await loadDatabaseSchema());
  } finally {
    await client.end();
  }
}

export async function checkDatabase(databaseUrl = process.env.DATABASE_URL): Promise<{ ok: true; table: string }> {
  const client = new Client({ connectionString: assertDatabaseUrl(databaseUrl) });
  await client.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.experience_memories') IS NOT NULL AS exists"
    );
    if (!result.rows[0]?.exists) {
      throw new Error("experience_memories table does not exist. Run npm run db:init.");
    }
    return { ok: true, table: "experience_memories" };
  } finally {
    await client.end();
  }
}
