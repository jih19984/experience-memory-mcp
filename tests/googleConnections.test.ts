import { describe, expect, it } from "vitest";
import { normalizeActor } from "../src/services/googleConnections.js";

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
});
