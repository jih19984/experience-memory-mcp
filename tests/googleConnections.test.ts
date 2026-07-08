import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalGoogleConnectionRepository, normalizeActor } from "../src/services/googleConnections.js";

describe("googleConnections", () => {
  it("normalizes provider actor identifiers", () => {
    expect(normalizeActor({ provider: "Kakao", providerUserId: " user-1 " })).toEqual({
      provider: "kakao",
      providerUserId: "user-1"
    });
  });

  it("rejects empty actor identifiers", () => {
    expect(() => normalizeActor({ provider: "", providerUserId: "user-1" })).toThrow("provider is required");
    expect(() => normalizeActor({ provider: "kakao", providerUserId: "" })).toThrow("providerUserId is required");
  });

  it("stores encrypted Google connections in a local JSON file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "experience-memory-connections-"));
    try {
      const repo = new LocalGoogleConnectionRepository(
        path.join(root, "connections.json"),
        "test-token-encryption-key-with-32-bytes"
      );
      await repo.upsertConnection({
        provider: "kakao",
        providerUserId: "user-1",
        refreshToken: "refresh-token",
        driveRootFolderId: "drive-root"
      });

      const connection = await repo.getConnection({ provider: "kakao", providerUserId: "user-1" });

      expect(connection?.refreshToken).toBe("refresh-token");
      expect(connection?.driveRootFolderId).toBe("drive-root");
      expect(connection?.userId).toBeTruthy();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
