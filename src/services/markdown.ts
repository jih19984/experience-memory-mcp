import type { ExperienceAnalysis, SaveExperienceMemoryInput } from "../types/memory.js";

export function buildMemoryMarkdown(input: {
  analysis: ExperienceAnalysis;
  request: SaveExperienceMemoryInput;
  occurredAt: string;
  photoUrl?: string;
}): string {
  const { analysis, request, occurredAt, photoUrl } = input;
  return [
    `# ${analysis.title}`,
    "",
    `- 날짜: ${occurredAt.slice(0, 10)}`,
    analysis.location ? `- 장소: ${analysis.location}` : undefined,
    analysis.activity ? `- 활동: ${analysis.activity}` : undefined,
    `- 감정: ${analysis.mood.join(", ")}`,
    `- 태그: ${analysis.tags.join(", ")}`,
    photoUrl ? `- 사진: ${photoUrl}` : undefined,
    "",
    "## 사용자 메모",
    "",
    request.userNote?.trim() || "(메모 없음)",
    "",
    "## AI 정리",
    "",
    analysis.summary,
    ""
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
