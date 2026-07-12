import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalDriveStorage, LocalMemoryRepository } from "../src/services/localAdapters.js";

describe("local demo adapters", () => {
  it("stores photo, markdown, and searchable metadata without external credentials", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "experience-memory-test-"));
    try {
      const drive = new LocalDriveStorage(root);
      const repo = new LocalMemoryRepository(path.join(root, "memories.json"));
      const photo = await drive.uploadPhoto({
        fileName: "2026-07-08_놀이공원.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("image"),
        occurredAt: "2026-07-08T00:00:00.000Z"
      });
      const note = await drive.uploadMarkdownNote({
        fileName: "2026-07-08_놀이공원.md",
        markdown: "# 놀이공원",
        occurredAt: "2026-07-08T00:00:00.000Z"
      });
      const row = await repo.insert({
        id: "memory-1",
        title: "놀이공원",
        summary: "즐거운 경험",
        userNote: "즐거웠다",
        occurredAt: "2026-07-08T00:00:00.000Z",
        tags: ["놀이공원"],
        mood: ["즐거움"],
        driveFileId: photo.fileId,
        driveNoteFileId: note.fileId,
        driveUrl: photo.webViewLink,
        markdownUrl: note.webViewLink,
        rawAnalysis: {
          title: "놀이공원",
          summary: "즐거운 경험",
          tags: ["놀이공원"],
          mood: ["즐거움"],
          filename: "놀이공원",
          confidence: { activity: 0, location: 0, mood: 0.7 }
        },
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      });

      const search = await repo.search({ query: "즐거운", limit: 10 });

      expect(photo.webViewLink).toContain("file://");
      expect(note.webViewLink).toContain("file://");
      expect(row.id).toBe("memory-1");
      expect(search[0].score).toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ranks exact tags and locations above loose substring matches", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "experience-memory-test-"));
    try {
      const repo = new LocalMemoryRepository(path.join(root, "memories.json"));
      await repo.insert({
        id: "amusement-park",
        title: "놀이공원 기억",
        summary: "놀이공원에서 캐릭터를 본 즐거운 기억.",
        userNote: "놀이공원에서 즐거웠다.",
        location: "놀이공원",
        occurredAt: "2026-07-08T00:00:00.000Z",
        tags: ["놀이공원", "캐릭터"],
        mood: ["즐거움"],
        driveUrl: "file:///amusement.png",
        rawAnalysis: {
          title: "놀이공원 기억",
          summary: "놀이공원에서 캐릭터를 본 즐거운 기억.",
          location: "놀이공원",
          tags: ["놀이공원", "캐릭터"],
          mood: ["즐거움"],
          filename: "놀이공원_기억",
          confidence: { activity: 0, location: 1, mood: 1 }
        },
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      });
      await repo.insert({
        id: "park-walk",
        title: "공원 산책길의 평온한 순간",
        summary: "초록 나무가 이어진 공원 산책로에서 여유롭게 걸은 기억.",
        userNote: "공원에서 산책했다.",
        activity: "산책",
        location: "공원",
        occurredAt: "2026-07-08T00:00:00.000Z",
        tags: ["공원", "산책", "나무"],
        mood: ["평온함"],
        driveUrl: "file:///park.png",
        rawAnalysis: {
          title: "공원 산책길의 평온한 순간",
          summary: "초록 나무가 이어진 공원 산책로에서 여유롭게 걸은 기억.",
          activity: "산책",
          location: "공원",
          tags: ["공원", "산책", "나무"],
          mood: ["평온함"],
          filename: "공원_산책길의_평온한_순간",
          confidence: { activity: 1, location: 1, mood: 1 }
        },
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      });

      const search = await repo.search({ query: "공원에서 산책했던 기억", limit: 10 });

      expect(search.map((row) => row.id)).toEqual(["park-walk", "amusement-park"]);
      expect(search[0].score).toBeGreaterThan(search[1].score);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps local memory rows separated by user id", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "experience-memory-users-"));
    const originalDataDir = process.env.EXPERIENCE_MEMORY_DATA_DIR;
    process.env.EXPERIENCE_MEMORY_DATA_DIR = root;
    try {
      const userA = new LocalMemoryRepository(undefined, "google:user-a");
      const userB = new LocalMemoryRepository(undefined, "google:user-b");
      await userA.insert(memoryRecord("a", "강아지 입양", "강아지"));
      await userB.insert(memoryRecord("b", "피노키오 독서", "독서"));

      expect((await userA.search({ query: "강아지", limit: 10 })).map((row) => row.id)).toEqual(["a"]);
      expect((await userB.search({ query: "강아지", limit: 10 })).map((row) => row.id)).toEqual([]);
    } finally {
      if (originalDataDir === undefined) {
        delete process.env.EXPERIENCE_MEMORY_DATA_DIR;
      } else {
        process.env.EXPERIENCE_MEMORY_DATA_DIR = originalDataDir;
      }
      await rm(root, { recursive: true, force: true });
    }
  });
});

function memoryRecord(id: string, title: string, tag: string) {
  return {
    id,
    title,
    summary: `${title} 기억`,
    userNote: `${title}을 저장했다.`,
    occurredAt: "2026-07-08T00:00:00.000Z",
    tags: [tag],
    mood: ["기쁨"],
    driveUrl: `file:///${id}.png`,
    rawAnalysis: {
      title,
      summary: `${title} 기억`,
      tags: [tag],
      mood: ["기쁨"],
      filename: title,
      confidence: { activity: 0, location: 0, mood: 1 }
    },
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z"
  };
}
