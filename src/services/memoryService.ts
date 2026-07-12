import { randomUUID } from "node:crypto";
import type {
  DeleteExperienceMemoryInput,
  ExperienceAnalysis,
  SaveExperienceMemoryInput,
  SaveExperienceMemoryOutput,
  SearchExperienceMemoriesInput,
  SearchMemoryResult,
  SummarizeExperienceMemoriesInput,
  UpdateExperienceMemoryInput,
  UpdateExperienceMemoryOutput
} from "../types/memory.js";
import type { DriveStorage, MemoryRepository } from "../types/ports.js";
import { normalizeOccurredAt } from "../utils/date.js";
import { buildMemoryBaseName, ensureUniqueName } from "../utils/filename.js";
import { loadImageAsset } from "../utils/image.js";
import { buildMemoryMarkdown } from "./markdown.js";

export class ExperienceMemoryService {
  constructor(
    private readonly dependencies: {
      drive: DriveStorage;
      repo: MemoryRepository;
    }
  ) {}

  async saveExperienceMemory(input: SaveExperienceMemoryInput): Promise<SaveExperienceMemoryOutput> {
    const hasImage = Boolean(input.imagePath?.trim() || input.imageUrl?.trim() || input.imageBase64?.trim());
    const hasUserNote = Boolean(input.userNote?.trim());
    if (!hasImage && !hasUserNote) {
      throw new Error("Either an image or userNote is required");
    }
    if (!input.title?.trim()) {
      throw new Error("title is required");
    }
    if (!input.summary?.trim()) {
      throw new Error("summary is required");
    }
    if (!input.tags?.length) {
      throw new Error("tags are required");
    }

    const occurredAt = normalizeOccurredAt(input.occurredAt);
    const [image, analysis] = await Promise.all([
      hasImage ? loadImageAsset(input) : Promise.resolve(undefined),
      Promise.resolve(toExperienceAnalysis(input))
    ]);
    const baseName = buildMemoryBaseName(occurredAt, analysis.filename || analysis.title);
    const photoFileName = image
      ? await ensureUniqueName(baseName, image.extension, (candidate) => this.dependencies.drive.exists(candidate, occurredAt))
      : undefined;
    const noteFileName = photoFileName?.replace(/\.[^.]+$/, ".md") ?? `${baseName}.md`;

    const uploadedPhoto = image
      ? await this.dependencies.drive.uploadPhoto({
          fileName: photoFileName as string,
          mimeType: image.mimeType,
          buffer: image.buffer,
          occurredAt
        })
      : undefined;
    let uploadedNote: Awaited<ReturnType<DriveStorage["uploadMarkdownNote"]>> | undefined;

    try {
      const markdown = buildMemoryMarkdown({
        analysis,
        request: input,
        occurredAt,
        photoUrl: uploadedPhoto?.webViewLink
      });
      uploadedNote = await this.dependencies.drive.uploadMarkdownNote({
        fileName: noteFileName,
        markdown,
        occurredAt
      });
      const now = new Date().toISOString();
      const record = await this.dependencies.repo.insert({
        id: randomUUID(),
        title: analysis.title,
        summary: analysis.summary,
        userNote: input.userNote?.trim() ?? "",
        activity: analysis.activity,
        location: analysis.location,
        occurredAt,
        tags: analysis.tags,
        mood: analysis.mood,
        driveFileId: uploadedPhoto?.fileId,
        driveNoteFileId: uploadedNote.fileId,
        driveUrl: uploadedPhoto?.webViewLink ?? uploadedNote.webViewLink,
        markdownUrl: uploadedNote.webViewLink,
        rawAnalysis: analysis,
        createdAt: now,
        updatedAt: now
      });

      return {
        memoryId: record.id,
        title: record.title,
        summary: record.summary,
        tags: record.tags,
        mood: record.mood,
        driveUrl: record.driveUrl,
        hasImage: Boolean(record.driveFileId)
      };
    } catch (error) {
      if (uploadedPhoto) {
        await this.dependencies.drive.deleteFile(uploadedPhoto.fileId).catch(() => undefined);
      }
      if (uploadedNote) {
        await this.dependencies.drive.deleteFile(uploadedNote.fileId).catch(() => undefined);
      }
      throw error;
    }
  }

  async searchExperienceMemories(input: SearchExperienceMemoriesInput): Promise<{ memories: SearchMemoryResult[] }> {
    const limit = input.limit ?? 10;
    const rows = await this.dependencies.repo.search({ ...input, limit });
    return {
      memories: rows
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          userNote: row.userNote || undefined,
          occurredAt: row.occurredAt,
          location: row.location,
          tags: row.tags,
          mood: row.mood,
          driveUrl: row.driveUrl,
          hasImage: Boolean(row.driveFileId),
          score: row.score
        }))
    };
  }

  async summarizeExperienceMemories(input: SummarizeExperienceMemoriesInput) {
    const rows = await this.dependencies.repo.listForSummary(input);
    const highlights = rows.slice(0, 5).map((row) => ({
      id: row.id,
      title: row.title,
      occurredAt: row.occurredAt,
      reason: `${row.mood.join(", ")} 감정과 ${row.tags.join(", ")} 태그가 두드러진 기억입니다.`
    }));
    const summary = rows.length
      ? `${rows.length}개의 경험을 찾았습니다. ${rows.map((row) => row.title).slice(0, 3).join(", ")} 같은 기억이 눈에 띕니다.`
      : "조건에 맞는 경험 기억이 아직 없습니다.";
    return { summary, highlights };
  }

  async updateExperienceMemory(input: UpdateExperienceMemoryInput): Promise<UpdateExperienceMemoryOutput> {
    const row = await this.dependencies.repo.getById(input.id);
    if (!row) {
      return { updated: false };
    }
    if (!hasUpdateFields(input)) {
      throw new Error("At least one field to update is required");
    }

    const occurredAt = input.occurredAt === undefined ? row.occurredAt : normalizeOccurredAt(input.occurredAt);
    const title = input.title === undefined ? row.title : requireTrimmed(input.title, "title");
    const summary = input.summary === undefined ? row.summary : requireTrimmed(input.summary, "summary");
    const userNote = input.userNote === undefined ? row.userNote : input.userNote?.trim() ?? "";
    const tags = input.tags === undefined ? row.tags : sanitizeRequiredList(input.tags, "tags");
    const mood = input.mood === undefined ? row.mood : sanitizeList(input.mood);
    const activity = input.activityHint === undefined ? row.activity : input.activityHint?.trim() || null;
    const location = input.locationHint === undefined ? row.location : input.locationHint?.trim() || null;
    const analysis: ExperienceAnalysis = {
      title,
      summary,
      activity,
      location,
      tags,
      mood,
      filename: title,
      confidence: {
        activity: activity ? 1 : 0,
        location: location ? 1 : 0,
        mood: mood.length ? 1 : 0
      }
    };
    if (
      title === row.title &&
      summary === row.summary &&
      userNote === row.userNote &&
      activity === (row.activity ?? null) &&
      location === (row.location ?? null) &&
      occurredAt === row.occurredAt &&
      arraysEqual(tags, row.tags) &&
      arraysEqual(mood, row.mood) &&
      row.driveNoteFileId
    ) {
      return {
        updated: true,
        memoryId: row.id,
        title: row.title,
        summary: row.summary,
        tags: row.tags,
        mood: row.mood,
        driveUrl: row.driveUrl,
        hasImage: Boolean(row.driveFileId)
      };
    }
    const markdown = buildMemoryMarkdown({
      analysis,
      request: {
        title,
        summary,
        userNote,
        tags,
        mood,
        activityHint: activity ?? undefined,
        occurredAt,
        locationHint: location ?? undefined
      },
      occurredAt,
      photoUrl: row.driveFileId ? row.driveUrl : undefined
    });
    const note = row.driveNoteFileId
      ? await this.dependencies.drive.updateMarkdownNote({ fileId: row.driveNoteFileId, markdown })
      : await this.dependencies.drive.uploadMarkdownNote({
          fileName: `${buildMemoryBaseName(occurredAt, title)}.md`,
          markdown,
          occurredAt
        });

    const updated = await this.dependencies.repo.update({
      ...row,
      title,
      summary,
      userNote,
      activity,
      location,
      occurredAt,
      tags,
      mood,
      driveNoteFileId: note.fileId,
      driveUrl: row.driveFileId ? row.driveUrl : note.webViewLink,
      markdownUrl: note.webViewLink,
      rawAnalysis: analysis,
      updatedAt: new Date().toISOString()
    });
    if (!updated) {
      return { updated: false };
    }

    return {
      updated: true,
      memoryId: updated.id,
      title: updated.title,
      summary: updated.summary,
      tags: updated.tags,
      mood: updated.mood,
      driveUrl: updated.driveUrl,
      hasImage: Boolean(updated.driveFileId)
    };
  }

  async deleteExperienceMemory(input: DeleteExperienceMemoryInput) {
    const row = await this.dependencies.repo.getById(input.id);
    if (!row) {
      return { deleted: false };
    }
    const deleted = await this.dependencies.repo.delete(input.id);
    if (deleted) {
      if (row.driveFileId) {
        await this.dependencies.drive.deleteFile(row.driveFileId).catch(() => undefined);
      }
      if (row.driveNoteFileId) {
        await this.dependencies.drive.deleteFile(row.driveNoteFileId).catch(() => undefined);
      }
    }
    return { deleted };
  }
}

function toExperienceAnalysis(input: SaveExperienceMemoryInput): ExperienceAnalysis {
  const title = input.title.trim();
  return {
    title,
    summary: input.summary.trim(),
    activity: input.activityHint?.trim() || null,
    location: input.locationHint?.trim() || null,
    tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
    mood: input.mood?.map((mood) => mood.trim()).filter(Boolean) ?? [],
    filename: title,
    confidence: {
      activity: input.activityHint ? 1 : 0,
      location: input.locationHint ? 1 : 0,
      mood: input.mood?.length ? 1 : 0
    }
  };
}

function hasUpdateFields(input: UpdateExperienceMemoryInput): boolean {
  return [
    input.title,
    input.summary,
    input.userNote,
    input.tags,
    input.mood,
    input.activityHint,
    input.occurredAt,
    input.locationHint
  ].some((value) => value !== undefined);
}

function requireTrimmed(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function sanitizeList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function sanitizeRequiredList(values: string[], fieldName: string): string[] {
  const sanitized = sanitizeList(values);
  if (!sanitized.length) {
    throw new Error(`${fieldName} are required`);
  }
  return sanitized;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
