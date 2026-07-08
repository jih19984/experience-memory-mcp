import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { decryptSecret, encryptSecret } from "./tokenCipher.js";

const { Pool } = pg;

export interface ActorRef {
  provider: string;
  providerUserId: string;
}

export interface GoogleConnectionInput extends ActorRef {
  googleSub?: string | null;
  email?: string | null;
  refreshToken: string;
  driveRootFolderId: string;
}

export interface GoogleDriveConnection {
  userId: string;
  provider: string;
  providerUserId: string;
  googleSub?: string | null;
  email?: string | null;
  refreshToken: string;
  driveRootFolderId: string;
}

export function normalizeActor(actor: ActorRef): ActorRef {
  const provider = actor.provider.trim().toLowerCase();
  const providerUserId = actor.providerUserId.trim();
  if (!provider) {
    throw new Error("provider is required");
  }
  if (!providerUserId) {
    throw new Error("providerUserId is required");
  }
  return { provider, providerUserId };
}

export class PostgresGoogleConnectionRepository {
  private readonly pool: pg.Pool;

  constructor(
    databaseUrl = process.env.DATABASE_URL,
    private readonly encryptionKey = process.env.TOKEN_ENCRYPTION_KEY
  ) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async upsertConnection(input: GoogleConnectionInput): Promise<GoogleDriveConnection> {
    const actor = normalizeActor(input);
    const encryptedRefreshToken = encryptSecret(input.refreshToken, this.encryptionKey);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO memory_users (provider, provider_user_id)
         VALUES ($1, $2)
         ON CONFLICT (provider, provider_user_id)
         DO UPDATE SET updated_at = now()
         RETURNING id`,
        [actor.provider, actor.providerUserId]
      );
      const userId = userResult.rows[0].id;
      await client.query(
        `INSERT INTO google_connections (
          user_id, google_sub, email, encrypted_refresh_token, drive_root_folder_id
        ) VALUES (
          $1, $2, $3, $4, $5
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          google_sub = EXCLUDED.google_sub,
          email = EXCLUDED.email,
          encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
          drive_root_folder_id = EXCLUDED.drive_root_folder_id,
          updated_at = now()`,
        [userId, input.googleSub ?? null, input.email ?? null, encryptedRefreshToken, input.driveRootFolderId]
      );
      await client.query("COMMIT");
      return {
        userId,
        provider: actor.provider,
        providerUserId: actor.providerUserId,
        googleSub: input.googleSub,
        email: input.email,
        refreshToken: input.refreshToken,
        driveRootFolderId: input.driveRootFolderId
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getConnection(actorInput: ActorRef): Promise<GoogleDriveConnection | undefined> {
    const actor = normalizeActor(actorInput);
    const result = await this.pool.query<{
      user_id: string;
      provider: string;
      provider_user_id: string;
      google_sub: string | null;
      email: string | null;
      encrypted_refresh_token: string;
      drive_root_folder_id: string;
    }>(
      `SELECT
        gc.user_id,
        u.provider,
        u.provider_user_id,
        gc.google_sub,
        gc.email,
        gc.encrypted_refresh_token,
        gc.drive_root_folder_id
       FROM google_connections gc
       JOIN memory_users u ON u.id = gc.user_id
       WHERE u.provider = $1 AND u.provider_user_id = $2`,
      [actor.provider, actor.providerUserId]
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      userId: row.user_id,
      provider: row.provider,
      providerUserId: row.provider_user_id,
      googleSub: row.google_sub,
      email: row.email,
      refreshToken: decryptSecret(row.encrypted_refresh_token, this.encryptionKey),
      driveRootFolderId: row.drive_root_folder_id
    };
  }
}

interface LocalGoogleConnectionRow {
  userId: string;
  provider: string;
  providerUserId: string;
  googleSub?: string | null;
  email?: string | null;
  encryptedRefreshToken: string;
  driveRootFolderId: string;
}

export class LocalGoogleConnectionRepository {
  constructor(
    private readonly filePath = path.join(process.env.EXPERIENCE_MEMORY_DATA_DIR ?? "/tmp/experience-memory", "google-connections.json"),
    private readonly encryptionKey = process.env.TOKEN_ENCRYPTION_KEY
  ) {}

  async upsertConnection(input: GoogleConnectionInput): Promise<GoogleDriveConnection> {
    const actor = normalizeActor(input);
    const rows = await this.readRows();
    const existingIndex = rows.findIndex(
      (row) => row.provider === actor.provider && row.providerUserId === actor.providerUserId
    );
    const userId = existingIndex >= 0 ? rows[existingIndex].userId : randomUUID();
    const row: LocalGoogleConnectionRow = {
      userId,
      provider: actor.provider,
      providerUserId: actor.providerUserId,
      googleSub: input.googleSub ?? null,
      email: input.email ?? null,
      encryptedRefreshToken: encryptSecret(input.refreshToken, this.encryptionKey),
      driveRootFolderId: input.driveRootFolderId
    };
    if (existingIndex >= 0) {
      rows[existingIndex] = row;
    } else {
      rows.push(row);
    }
    await this.writeRows(rows);
    return {
      userId,
      provider: actor.provider,
      providerUserId: actor.providerUserId,
      googleSub: input.googleSub,
      email: input.email,
      refreshToken: input.refreshToken,
      driveRootFolderId: input.driveRootFolderId
    };
  }

  async getConnection(actorInput: ActorRef): Promise<GoogleDriveConnection | undefined> {
    const actor = normalizeActor(actorInput);
    const rows = await this.readRows();
    const row = rows.find((item) => item.provider === actor.provider && item.providerUserId === actor.providerUserId);
    if (!row) {
      return undefined;
    }
    return {
      userId: row.userId,
      provider: row.provider,
      providerUserId: row.providerUserId,
      googleSub: row.googleSub,
      email: row.email,
      refreshToken: decryptSecret(row.encryptedRefreshToken, this.encryptionKey),
      driveRootFolderId: row.driveRootFolderId
    };
  }

  private async readRows(): Promise<LocalGoogleConnectionRow[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as LocalGoogleConnectionRow[];
    } catch {
      return [];
    }
  }

  private async writeRows(rows: LocalGoogleConnectionRow[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(rows, null, 2), "utf8");
  }
}
