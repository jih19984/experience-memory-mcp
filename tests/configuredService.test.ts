import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("configured ExperienceMemoryService", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("does not fall back to local storage when Google Drive configuration is missing", async () => {
    delete process.env.EXPERIENCE_MEMORY_MODE;
    delete process.env.DATABASE_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    delete process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    const { getConfiguredExperienceMemoryService } = await import("../src/services/configuredService.js");

    await expect(getConfiguredExperienceMemoryService()).rejects.toThrow(/Missing Google Drive configuration/);
  });

  it("requires both actor provider and actor id when actor mode is requested", async () => {
    const { resolveConfiguredActor } = await import("../src/services/configuredService.js");

    expect(() => resolveConfiguredActor({ provider: "kakao" })).toThrow(
      /Both actor provider and actor id are required/
    );
    expect(() => resolveConfiguredActor({ provider: "kakao", providerUserId: "user-1" })).not.toThrow();
  });
});
