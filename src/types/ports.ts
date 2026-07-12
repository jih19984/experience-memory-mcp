import type { ExperienceMemoryRecord, SearchExperienceMemoriesInput, SummarizeExperienceMemoriesInput } from "./memory.js";

export interface ImageAsset {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export interface DriveStorage {
  uploadPhoto(input: { fileName: string; mimeType: string; buffer: Buffer; occurredAt: string }): Promise<DriveUploadResult>;
  uploadMarkdownNote(input: { fileName: string; markdown: string; occurredAt: string }): Promise<DriveUploadResult>;
  updateMarkdownNote(input: { fileId: string; markdown: string }): Promise<DriveUploadResult>;
  exists(fileName: string, occurredAt: string): Promise<boolean>;
  deleteFile(fileId: string): Promise<void>;
}

export interface MemoryRepository {
  insert(record: ExperienceMemoryRecord): Promise<ExperienceMemoryRecord>;
  search(input: SearchExperienceMemoriesInput & { limit: number }): Promise<Array<ExperienceMemoryRecord & { score: number }>>;
  listForSummary(input: SummarizeExperienceMemoriesInput): Promise<ExperienceMemoryRecord[]>;
  getById(id: string): Promise<ExperienceMemoryRecord | undefined>;
  update(record: ExperienceMemoryRecord): Promise<ExperienceMemoryRecord | undefined>;
  delete(id: string): Promise<boolean>;
}
