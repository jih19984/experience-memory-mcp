import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export function encryptSecret(plainText: string, keyMaterial = process.env.TOKEN_ENCRYPTION_KEY): string {
  const key = deriveKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string, keyMaterial = process.env.TOKEN_ENCRYPTION_KEY): string {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted secret payload");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(keyMaterial), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

function deriveKey(keyMaterial: string | undefined): Buffer {
  if (!keyMaterial) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }
  return createHash("sha256").update(keyMaterial).digest();
}
