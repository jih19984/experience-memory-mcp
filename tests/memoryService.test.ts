import { describe, expect, it } from "vitest";
import { ExperienceMemoryService } from "../src/services/memoryService.js";
import type { DriveStorage, MemoryRepository } from "../src/types/ports.js";
import type { ExperienceMemoryRecord } from "../src/types/memory.js";

class FakeDrive implements DriveStorage {
  uploads: Array<{ kind: "photo" | "note"; fileName: string }> = [];
  deleted: string[] = [];
  notes = new Map<string, string>();

  async uploadPhoto(input: { fileName: string }) {
    this.uploads.push({ kind: "photo", fileName: input.fileName });
    return {
      fileId: "photo-file-id",
      webViewLink: `https://drive.example/${input.fileName}`
    };
  }

  async uploadMarkdownNote(input: { fileName: string; markdown: string }) {
    this.uploads.push({ kind: "note", fileName: input.fileName });
    this.notes.set("note-file-id", input.markdown);
    return {
      fileId: "note-file-id",
      webViewLink: `https://drive.example/${input.fileName}`
    };
  }

  async updateMarkdownNote(input: { fileId: string; markdown: string }) {
    this.notes.set(input.fileId, input.markdown);
    return {
      fileId: input.fileId,
      webViewLink: `https://drive.example/${input.fileId}.md`
    };
  }

  async exists() {
    return false;
  }

  async deleteFile(fileId: string) {
    this.deleted.push(fileId);
  }
}

class FakeRepo implements MemoryRepository {
  rows: ExperienceMemoryRecord[] = [];

  async insert(record: ExperienceMemoryRecord) {
    this.rows.push(record);
    return record;
  }

  async search(input: { query: string; limit: number }) {
    const query = input.query.toLowerCase();
    return this.rows
      .map((row) => ({
        ...row,
        score: `${row.title} ${row.summary} ${row.userNote} ${row.tags.join(" ")} ${row.mood.join(" ")}`
          .toLowerCase()
          .includes(query)
          ? 1
          : 0.2
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);
  }

  async listForSummary() {
    return this.rows;
  }

  async getById(id: string) {
    return this.rows.find((row) => row.id === id);
  }

  async update(record: ExperienceMemoryRecord) {
    const index = this.rows.findIndex((row) => row.id === record.id);
    if (index === -1) {
      return undefined;
    }
    this.rows[index] = record;
    return record;
  }

  async delete(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.id !== id);
    return before !== this.rows.length;
  }
}

describe("ExperienceMemoryService", () => {
  it("saves LLM-prepared memory metadata without calling another AI service", async () => {
    const drive = new FakeDrive();
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive, repo });

    const result = await service.saveExperienceMemory({
      imageBase64: Buffer.from("fake-image").toString("base64"),
      userNote: "오늘 한강에서 뛰었는데 힘들었지만 야경이 좋아서 버텼어.",
      title: "한강 야경 러닝",
      summary: "힘들었지만 한강 야경 덕분에 끝까지 버틴 러닝 경험.",
      tags: ["한강", "러닝", "야경"],
      mood: ["힘듦", "만족", "개운함"],
      activityHint: "러닝",
      occurredAt: "2026-07-08T10:30:00.000Z",
      locationHint: "한강"
    });

    expect(result.title).toBe("한강 야경 러닝");
    expect(result.tags).toEqual(["한강", "러닝", "야경"]);
    expect(result.mood).toEqual(["힘듦", "만족", "개운함"]);
    expect(result.driveUrl).toContain("https://drive.example/");
    expect(result.hasImage).toBe(true);
    expect(drive.uploads.map((upload) => upload.kind)).toEqual(["photo", "note"]);
    expect(repo.rows[0].rawAnalysis.title).toBe("한강 야경 러닝");
  });

  it("saves a text-only memory without uploading a photo", async () => {
    const drive = new FakeDrive();
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive, repo });

    const result = await service.saveExperienceMemory({
      userNote: "오늘 친구와 성수에서 전시를 봤는데 조명이 특히 기억에 남았어.",
      title: "성수 전시 관람",
      summary: "친구와 성수에서 전시를 보고 조명이 인상 깊었던 경험.",
      tags: ["성수", "전시", "친구"],
      mood: ["즐거움", "인상적"],
      occurredAt: "2026-07-12T10:30:00.000Z",
      locationHint: "성수"
    });

    expect(result.hasImage).toBe(false);
    expect(result.driveUrl).toContain(".md");
    expect(drive.uploads.map((upload) => upload.kind)).toEqual(["note"]);
    expect(repo.rows[0].driveFileId).toBeUndefined();
    expect(repo.rows[0].driveNoteFileId).toBe("note-file-id");
  });

  it("saves a photo-only memory when the calling LLM supplies metadata", async () => {
    const drive = new FakeDrive();
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive, repo });

    const result = await service.saveExperienceMemory({
      imageBase64: Buffer.from("fake-image").toString("base64"),
      title: "공원 산책 사진",
      summary: "공원 산책길에서 찍은 평온한 순간.",
      tags: ["공원", "산책"],
      mood: ["평온함"]
    });

    expect(result.hasImage).toBe(true);
    expect(drive.uploads.map((upload) => upload.kind)).toEqual(["photo", "note"]);
    expect(repo.rows[0].userNote).toBe("");
  });

  it("rejects empty memory requests without an image or note", async () => {
    const service = new ExperienceMemoryService({ drive: new FakeDrive(), repo: new FakeRepo() });

    await expect(
      service.saveExperienceMemory({
        title: "빈 기억",
        summary: "입력이 없는 기억.",
        tags: ["빈값"]
      })
    ).rejects.toThrow(/Either an image or userNote is required/);
  });

  it("searches memories with default limit using repository text search", async () => {
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive: new FakeDrive(), repo });
    await service.saveExperienceMemory({
      imageBase64: Buffer.from("fake-image").toString("base64"),
      userNote: "비 오는 날 카페에서 조용히 책을 읽었다.",
      title: "비 오는 날 카페",
      summary: "비 오는 날 카페에서 책을 읽은 차분한 기억.",
      tags: ["카페", "비", "독서"],
      mood: ["차분함"]
    });

    const result = await service.searchExperienceMemories({ query: "비 오는 날 카페" });

    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].score).toBe(1);
  });

  it("deletes database row and associated Drive files", async () => {
    const drive = new FakeDrive();
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive, repo });
    const saved = await service.saveExperienceMemory({
      imageBase64: Buffer.from("fake-image").toString("base64"),
      userNote: "한강 러닝",
      title: "한강 러닝",
      summary: "한강에서 달린 기억.",
      tags: ["한강", "러닝"],
      mood: ["상쾌함"]
    });

    const result = await service.deleteExperienceMemory({ id: saved.memoryId });

    expect(result.deleted).toBe(true);
    expect(repo.rows).toHaveLength(0);
    expect(drive.deleted).toEqual(["photo-file-id", "note-file-id"]);
  });

  it("updates memory metadata and refreshes the markdown note", async () => {
    const drive = new FakeDrive();
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive, repo });
    const saved = await service.saveExperienceMemory({
      userNote: "엄마랑 치킨을 먹었다.",
      title: "치킨",
      summary: "치킨을 먹은 기억.",
      tags: ["치킨"],
      mood: ["만족"]
    });

    const result = await service.updateExperienceMemory({
      id: saved.memoryId,
      title: "엄마와 먹은 치킨",
      summary: "엄마와 함께 바삭한 치킨을 먹은 기억.",
      tags: ["엄마", "치킨", "가족"],
      mood: ["따뜻함", "만족"],
      locationHint: "집"
    });

    expect(result.updated).toBe(true);
    expect(result.title).toBe("엄마와 먹은 치킨");
    expect(repo.rows[0].title).toBe("엄마와 먹은 치킨");
    expect(repo.rows[0].location).toBe("집");
    expect(repo.rows[0].tags).toEqual(["엄마", "치킨", "가족"]);
    expect(drive.notes.get("note-file-id")).toContain("# 엄마와 먹은 치킨");
    expect(drive.notes.get("note-file-id")).toContain("- 장소: 집");
  });

  it("keeps repeated updates idempotent when values are unchanged", async () => {
    const drive = new FakeDrive();
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive, repo });
    const saved = await service.saveExperienceMemory({
      userNote: "엄마랑 치킨을 먹었다.",
      title: "엄마와 먹은 치킨",
      summary: "엄마와 함께 치킨을 먹은 기억.",
      tags: ["엄마", "치킨"],
      mood: ["만족"]
    });
    const originalUpdatedAt = repo.rows[0].updatedAt;
    drive.notes.clear();

    const result = await service.updateExperienceMemory({
      id: saved.memoryId,
      title: "엄마와 먹은 치킨",
      summary: "엄마와 함께 치킨을 먹은 기억.",
      tags: ["엄마", "치킨"],
      mood: ["만족"]
    });

    expect(result.updated).toBe(true);
    expect(repo.rows[0].updatedAt).toBe(originalUpdatedAt);
    expect(drive.notes.size).toBe(0);
  });

  it("requires at least one field for updates", async () => {
    const repo = new FakeRepo();
    const service = new ExperienceMemoryService({ drive: new FakeDrive(), repo });
    const saved = await service.saveExperienceMemory({
      userNote: "수정할 기억",
      title: "수정할 기억",
      summary: "수정할 기억.",
      tags: ["수정"],
      mood: ["평온"]
    });

    await expect(service.updateExperienceMemory({ id: saved.memoryId })).rejects.toThrow(/At least one field/);
  });
});
