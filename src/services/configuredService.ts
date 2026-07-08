import { ExperienceMemoryService } from "./memoryService.js";
import { GoogleDriveStorage } from "./googleDrive.js";
import { PostgresGoogleConnectionRepository } from "./googleConnections.js";
import { PostgresMemoryRepository } from "./database.js";

export interface ExperienceActor {
  provider: string;
  providerUserId: string;
}

export interface ConfiguredServiceOptions {
  actor?: ExperienceActor;
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
  const actor =
    options.actor ??
    resolveConfiguredActor({
      provider: process.env.EXPERIENCE_MEMORY_ACTOR_PROVIDER,
      providerUserId: process.env.EXPERIENCE_MEMORY_ACTOR_ID
    });

  if (actor) {
    const connections = new PostgresGoogleConnectionRepository();
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
      repo: new PostgresMemoryRepository(undefined, connection.userId)
    });
  }

  return new ExperienceMemoryService({
    drive: new GoogleDriveStorage(),
    repo: new PostgresMemoryRepository()
  });
}
