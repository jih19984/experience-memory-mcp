import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/services/tokenCipher.js";

describe("tokenCipher", () => {
  it("encrypts and decrypts refresh tokens", () => {
    const key = "test-encryption-key";
    const encrypted = encryptSecret("refresh-token", key);

    expect(encrypted).not.toContain("refresh-token");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token");
  });

  it("fails with the wrong encryption key", () => {
    const encrypted = encryptSecret("refresh-token", "correct-key");

    expect(() => decryptSecret(encrypted, "wrong-key")).toThrow();
  });
});
