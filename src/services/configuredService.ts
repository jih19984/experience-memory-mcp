import { ExperienceMemoryService } from "./memoryService.js";
import { GoogleDriveStorage } from "./googleDrive.js";
import { LocalGoogleConnectionRepository, PostgresGoogleConnectionRepository } from "./googleConnections.js";
import { PostgresMemoryRepository } from "./database.js";
import { LocalMemoryRepository } from "./localAdapters.js";
import { getGoogleOAuthUser } from "./googleOAuth.js";

export interface ExperienceActor {
  provider: string;
  providerUserId: string;
}

export interface ConfiguredServiceOptions {
  actor?: ExperienceActor;
  googleAccessToken?: string;
}

export function resolveConfiguredActor(input: {
  provider?: string;
  providerUserId?: string;
}): ExperienceActor | undefined {
  const provider = input.provider?.trim();
  const providerUserId = input.providerUserId?.trim();
  if (!provider && !providerUserId) {
    return undefined;
  }
  if (!provider || !providerUserId) {
    throw new Error("Both actor provider and actor id are required for multi-user mode");
  }
  return { provider, providerUserId };
}

export async function getConfiguredExperienceMemoryService(
  options: ConfiguredServiceOptions = {}
): Promise<ExperienceMemoryService> {
  if (options.googleAccessToken) {
    const googleUser = await getGoogleOAuthUser(options.googleAccessToken);
    const userId = `google:${googleUser.id}`;
    return new ExperienceMemoryService({
      drive: new GoogleDriveStorage({
        accessToken: options.googleAccessToken,
        rootFolderName: process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME
      }),
      repo: createMemoryRepository(userId)
    });
  }

  const actor =
    options.actor ??
    resolveConfiguredActor({
      provider: process.env.EXPERIENCE_MEMORY_ACTOR_PROVIDER,
      providerUserId: process.env.EXPERIENCE_MEMORY_ACTOR_ID
    });

  if (actor) {
    const connections = createGoogleConnectionRepository();
    const connection = await connections.getConnection(actor);
    if (!connection) {
      throw new Error(`Google Drive is not connected for actor ${actor.provider}:${actor.providerUserId}`);
    }
    return new ExperienceMemoryService({
      drive: new GoogleDriveStorage({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: connection.refreshToken,
        rootFolderId: connection.driveRootFolderId
      }),
      repo: createMemoryRepository(connection.userId)
    });
  }

  if (!hasLegacyGoogleDriveConfig()) {
    throw new Error(
      "Google Drive authentication is missing. PlayMCP did not forward a Google OAuth Bearer token, and no fallback Google Drive credentials are configured."
    );
  }

  return new ExperienceMemoryService({
    drive: new GoogleDriveStorage(),
    repo: createMemoryRepository()
  });
}

export function createGoogleConnectionRepository() {
  return process.env.DATABASE_URL ? new PostgresGoogleConnectionRepository() : new LocalGoogleConnectionRepository();
}

function createMemoryRepository(userId?: string) {
  return process.env.DATABASE_URL ? new PostgresMemoryRepository(undefined, userId) : new LocalMemoryRepository(undefined, userId);
}

function hasLegacyGoogleDriveConfig(): boolean {
  if (process.env.GOOGLE_ACCESS_TOKEN?.trim()) {
    return true;
  }
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REFRESH_TOKEN?.trim() &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()
  );
}
