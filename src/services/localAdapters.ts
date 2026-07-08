import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ExperienceMemoryRecord,
  SearchExperienceMemoriesInput,
  SummarizeExperienceMemoriesInput
} from "../types/memory.js";
import type { DriveStorage, DriveUploadResult, MemoryRepository } from "../types/ports.js";
import { yearMonthPath } from "../utils/date.js";
import { searchTerms } from "../utils/searchTerms.js";

export class LocalDriveStorage implements DriveStorage {
  constructor(private readonly root = process.env.EXPERIENCE_MEMORY_LOCAL_DIR ?? ".experience-memory") {}

  async uploadPhoto(input: { fileName: string; mimeType: string; buffer: Buffer; occurredAt: string }): Promise<DriveUploadResult> {
    const filePath = await this.writeDatedFile("photos", input.occurredAt, input.fileName, input.buffer);
    return localUploadResult(filePath);
  }

  async uploadMarkdownNote(input: { fileName: string; markdown: string; occurredAt: string }): Promise<DriveUploadResult> {
    const filePath = await this.writeDatedFile("notes", input.occurredAt, input.fileName, Buffer.from(input.markdown, "utf8"));
    return localUploadResult(filePath);
  }

  async exists(fileName: string, occurredAt: string): Promise<boolean> {
    const filePath = this.datedPath("photos", occurredAt, fileName);
    try {
      await readFile(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (fileId.startsWith("local:")) {
      await rm(fileId.slice("local:".length), { force: true });
    }
  }

  private async writeDatedFile(kind: "photos" | "notes", occurredAt: string, fileName: string, data: Buffer): Promise<string> {
    const filePath = this.datedPath(kind, occurredAt, fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return path.resolve(filePath);
  }

  private datedPath(kind: "photos" | "notes", occurredAt: string, fileName: string): string {
    const { year, month } = yearMonthPath(occurredAt);
    return path.join(this.root, kind, year, month, fileName);
  }
}

export class LocalMemoryRepository implements MemoryRepository {
  constructor(private readonly filePath = path.join(process.env.EXPERIENCE_MEMORY_LOCAL_DIR ?? ".experience-memory", "memories.json")) {}

  async insert(record: ExperienceMemoryRecord): Promise<ExperienceMemoryRecord> {
    const rows = await this.readRows();
    rows.push(record);
    await this.writeRows(rows);
    return record;
  }

  async search(input: SearchExperienceMemoriesInput & { limit: number }): Promise<Array<ExperienceMemoryRecord & { score: number }>> {
    const rows = await this.readRows();
    return rows
      .filter((row) => withinFilters(row, input))
      .map((row) => ({ ...row, score: textScore(row, input.query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);
  }

  async listForSummary(input: SummarizeExperienceMemoriesInput): Promise<ExperienceMemoryRecord[]> {
    const rows = await this.readRows();
    return rows
      .filter((row) => {
        if (input.from && row.occurredAt < new Date(input.from).toISOString()) return false;
        if (input.to && row.occurredAt > new Date(input.to).toISOString()) return false;
        if (input.theme) {
          const text = `${row.title} ${row.summary} ${row.userNote} ${row.tags.join(" ")}`;
          return text.includes(input.theme);
        }
        return true;
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async getById(id: string): Promise<ExperienceMemoryRecord | undefined> {
    const rows = await this.readRows();
    return rows.find((row) => row.id === id);
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.readRows();
    const next = rows.filter((row) => row.id !== id);
    await this.writeRows(next);
    return next.length !== rows.length;
  }

  private async readRows(): Promise<ExperienceMemoryRecord[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as ExperienceMemoryRecord[];
    } catch {
      return [];
    }
  }

  private async writeRows(rows: ExperienceMemoryRecord[]): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(rows, null, 2), "utf8");
  }
}

function localUploadResult(filePath: string): DriveUploadResult {
  return {
    fileId: `local:${filePath}`,
    webViewLink: `file://${filePath}`
  };
}

function withinFilters(row: ExperienceMemoryRecord, input: SearchExperienceMemoriesInput): boolean {
  if (input.from && row.occurredAt < new Date(input.from).toISOString()) return false;
  if (input.to && row.occurredAt > new Date(input.to).toISOString()) return false;
  if (input.tags?.length && !input.tags.some((tag) => row.tags.includes(tag))) return false;
  if (input.mood?.length && !input.mood.some((mood) => row.mood.includes(mood))) return false;
  return true;
}

function textScore(row: ExperienceMemoryRecord, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const title = row.title.toLowerCase();
  const searchable = [
    row.title,
    row.summary,
    row.userNote,
    row.activity,
    row.location,
    ...row.tags,
    ...row.mood
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (title.includes(normalizedQuery)) return 1;
  if (searchable.includes(normalizedQuery)) return 0.8;

  const terms = searchTerms(normalizedQuery);
  let score = 0;
  for (const term of terms) {
    if (row.tags.some((tag) => tag.toLowerCase() === term)) score += 3;
    else if (row.location?.toLowerCase() === term) score += 3;
    else if (row.activity?.toLowerCase() === term) score += 2.5;
    else if (row.mood.some((mood) => mood.toLowerCase() === term)) score += 2;
    else if (title.split(/\s+/).includes(term)) score += 1.5;
    else if (searchable.includes(term)) score += 0.5;
  }
  return terms.length ? score / terms.length : 0;
}
