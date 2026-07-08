import { describe, expect, it } from "vitest";
import { buildGoogleAuthUrl, GOOGLE_DRIVE_FILE_SCOPE } from "../src/services/googleOAuth.js";

describe("Google OAuth helper", () => {
  it("builds an offline Drive file authorization URL", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "http://localhost:53682/oauth2callback"
      })
    );

    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_DRIVE_FILE_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:53682/oauth2callback");
  });
});
