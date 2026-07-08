import pg from "pg";
import type {
  ExperienceAnalysis,
  ExperienceMemoryRecord,
  SearchExperienceMemoriesInput,
  SummarizeExperienceMemoriesInput
} from "../types/memory.js";
import type { MemoryRepository } from "../types/ports.js";
import { searchTerms } from "../utils/searchTerms.js";

const { Pool } = pg;

export class PostgresMemoryRepository implements MemoryRepository {
  private readonly pool: pg.Pool;

  constructor(databaseUrl = process.env.DATABASE_URL, private readonly userId?: string | null) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async insert(record: ExperienceMemoryRecord): Promise<ExperienceMemoryRecord> {
    const result = await this.pool.query(
      `INSERT INTO experience_memories (
        id, user_id, title, summary, user_note, activity, location, occurred_at,
        tags, mood, drive_file_id, drive_note_file_id, drive_url, markdown_url,
        raw_analysis, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17
      )
      RETURNING *`,
      [
        record.id,
        record.userId ?? this.userId ?? null,
        record.title,
        record.summary,
        record.userNote,
        record.activity,
        record.location,
        record.occurredAt,
        record.tags,
        record.mood,
        record.driveFileId,
        record.driveNoteFileId,
        record.driveUrl,
        record.markdownUrl,
        record.rawAnalysis,
        record.createdAt,
        record.updatedAt
      ]
    );
    return mapRow(result.rows[0]);
  }

  async search(input: SearchExperienceMemoriesInput & { limit: number }): Promise<Array<ExperienceMemoryRecord & { score: number }>> {
    const terms = searchTerms(input.query);
    const values: unknown[] = terms.map((term) => `%${term}%`);
    const termConditions = terms.map(
      (_term, index) =>
        `(title ILIKE $${index + 1}
          OR summary ILIKE $${index + 1}
          OR user_note ILIKE $${index + 1}
          OR COALESCE(activity, '') ILIKE $${index + 1}
          OR COALESCE(location, '') ILIKE $${index + 1}
          OR array_to_string(tags, ' ') ILIKE $${index + 1}
          OR array_to_string(mood, ' ') ILIKE $${index + 1})`
    );
    const scoreExpression = terms.length
      ? terms
          .map(
            (_term, index) =>
              `(CASE
                WHEN title ILIKE $${index + 1} THEN 1.0
                WHEN summary ILIKE $${index + 1} OR user_note ILIKE $${index + 1} THEN 0.8
                WHEN COALESCE(activity, '') ILIKE $${index + 1} OR COALESCE(location, '') ILIKE $${index + 1} THEN 0.7
                WHEN array_to_string(tags, ' ') ILIKE $${index + 1} OR array_to_string(mood, ' ') ILIKE $${index + 1} THEN 0.7
                ELSE 0
              END)`
          )
          .join(" + ")
      : "0";
    const filters: string[] = terms.length ? [`(${termConditions.join(" OR ")})`] : [];

    if (input.from) {
      values.push(input.from);
      filters.push(`occurred_at >= $${values.length}`);
    }
    if (input.to) {
      values.push(input.to);
      filters.push(`occurred_at <= $${values.length}`);
    }
    if (input.tags?.length) {
      values.push(input.tags);
      filters.push(`tags && $${values.length}`);
    }
    if (input.mood?.length) {
      values.push(input.mood);
      filters.push(`mood && $${values.length}`);
    }
    if (this.userId) {
      values.push(this.userId);
      filters.push(`user_id = $${values.length}`);
    }
    values.push(input.limit);

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await this.pool.query(
      `SELECT *,
        (${scoreExpression}) AS score
       FROM experience_memories
       ${where}
       ORDER BY score DESC, occurred_at DESC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map((row) => ({ ...mapRow(row), score: Number(row.score) }));
  }

  async listForSummary(input: SummarizeExperienceMemoriesInput): Promise<ExperienceMemoryRecord[]> {
    const values: unknown[] = [];
    const filters: string[] = [];

    if (input.from) {
      values.push(input.from);
      filters.push(`occurred_at >= $${values.length}`);
    }
    if (input.to) {
      values.push(input.to);
      filters.push(`occurred_at <= $${values.length}`);
    }
    if (input.theme) {
      values.push(`%${input.theme}%`);
      filters.push(`(summary ILIKE $${values.length} OR title ILIKE $${values.length} OR user_note ILIKE $${values.length})`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await this.pool.query(
      `SELECT * FROM experience_memories ${where} ORDER BY occurred_at DESC LIMIT 50`,
      values
    );
    return result.rows.map(mapRow);
  }

  async getById(id: string): Promise<ExperienceMemoryRecord | undefined> {
    const result = await this.pool.query("SELECT * FROM experience_memories WHERE id = $1", [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : undefined;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM experience_memories WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

function mapRow(row: any): ExperienceMemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    summary: row.summary,
    userNote: row.user_note,
    activity: row.activity,
    location: row.location,
    occurredAt: new Date(row.occurred_at).toISOString(),
    tags: row.tags ?? [],
    mood: row.mood ?? [],
    driveFileId: row.drive_file_id,
    driveNoteFileId: row.drive_note_file_id,
    driveUrl: row.drive_url,
    markdownUrl: row.markdown_url,
    rawAnalysis: row.raw_analysis as ExperienceAnalysis,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}
