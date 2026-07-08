import { describe, expect, it } from "vitest";
import { buildMemoryBaseName, ensureUniqueName, sanitizeFilenamePart } from "../src/utils/filename.js";

describe("filename utilities", () => {
  it("removes unsafe filename characters while preserving Korean text", () => {
    expect(sanitizeFilenamePart("한강/야경: 러닝?*")).toBe("한강_야경_러닝");
  });

  it("builds date-prefixed memory filenames", () => {
    expect(buildMemoryBaseName("2026-07-08T10:30:00.000Z", "한강 야경 러닝")).toBe("2026-07-08_한강_야경_러닝");
  });

  it("adds a numeric suffix when a name already exists", async () => {
    const existing = new Set(["2026-07-08_한강_야경_러닝.jpg", "2026-07-08_한강_야경_러닝-2.jpg"]);
    const unique = await ensureUniqueName("2026-07-08_한강_야경_러닝", ".jpg", async (candidate) => existing.has(candidate));

    expect(unique).toBe("2026-07-08_한강_야경_러닝-3.jpg");
  });
});
