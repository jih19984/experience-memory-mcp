import { afterEach, describe, expect, it } from "vitest";
import { connectGoogleDrive } from "../src/tools/connectGoogleDrive.js";

const originalEnv = { ...process.env };

describe("connectGoogleDrive", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("requires a host-provided user actor", async () => {
    await expect(connectGoogleDrive({})).rejects.toThrow(/user actor header/);
  });

  it("returns a Google OAuth URL for the current actor", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key-with-32-bytes";

    const result = await connectGoogleDrive(
      {},
      {
        actor: { provider: "kakao", providerUserId: "user-1" },
        redirectUri: "https://example.com/oauth/google/callback"
      }
    );

    expect(result.connected).toBe(false);
    expect(result.authUrl).toContain("https://accounts.google.com/o/oauth2");
    expect(result.authUrl).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Foauth%2Fgoogle%2Fcallback");
    expect(result.authUrl).toContain("state=");
  });
});
