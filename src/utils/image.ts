import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SaveExperienceMemoryInput } from "../types/memory.js";
import type { ImageAsset } from "../types/ports.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic"
};

export async function loadImageAsset(input: SaveExperienceMemoryInput): Promise<ImageAsset> {
  if (input.imageBase64) {
    const match = input.imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
    const base64 = match?.[2] ?? input.imageBase64;
    const mimeType = match?.[1] ?? "image/jpeg";
    return {
      buffer: Buffer.from(base64, "base64"),
      mimeType,
      extension: extensionFromMime(mimeType)
    };
  }

  if (input.imagePath) {
    const extension = normalizeExtension(path.extname(input.imagePath));
    return {
      buffer: await readFile(input.imagePath),
      mimeType: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
      extension
    };
  }

  if (input.imageUrl) {
    const response = await fetch(input.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download imageUrl: HTTP ${response.status}`);
    }
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType,
      extension: extensionFromMime(mimeType)
    };
  }

  throw new Error("One of imagePath, imageUrl, or imageBase64 is required");
}

function normalizeExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  return normalized || ".jpg";
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes("png")) {
    return ".png";
  }
  if (mimeType.includes("webp")) {
    return ".webp";
  }
  if (mimeType.includes("gif")) {
    return ".gif";
  }
  if (mimeType.includes("heic")) {
    return ".heic";
  }
  return ".jpg";
}
