import type { ExperienceAnalysis, SaveExperienceMemoryInput } from "../types/memory.js";

export function buildMemoryMarkdown(input: {
  analysis: ExperienceAnalysis;
  request: SaveExperienceMemoryInput;
  occurredAt: string;
  driveUrl: string;
}): string {
  const { analysis, request, occurredAt, driveUrl } = input;
  return [
    `# ${analysis.title}`,
    "",
    `- 날짜: ${occurredAt.slice(0, 10)}`,
    analysis.location ? `- 장소: ${analysis.location}` : undefined,
    analysis.activity ? `- 활동: ${analysis.activity}` : undefined,
    `- 감정: ${analysis.mood.join(", ")}`,
    `- 태그: ${analysis.tags.join(", ")}`,
    `- 사진: ${driveUrl}`,
    "",
    "## 사용자 메모",
    "",
    request.userNote,
    "",
    "## AI 정리",
    "",
    analysis.summary,
    ""
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
