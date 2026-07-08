export interface SaveExperienceMemoryInput {
  imagePath?: string;
  imageUrl?: string;
  imageBase64?: string;
  userNote: string;
  title: string;
  summary: string;
  tags: string[];
  mood?: string[];
  activityHint?: string;
  occurredAt?: string;
  locationHint?: string;
}

export interface SearchExperienceMemoriesInput {
  query: string;
  from?: string;
  to?: string;
  tags?: string[];
  mood?: string[];
  limit?: number;
}

export interface SummarizeExperienceMemoriesInput {
  period?: "week" | "month" | "year" | "all";
  from?: string;
  to?: string;
  theme?: string;
}

export interface DeleteExperienceMemoryInput {
  id: string;
}

export interface ExperienceAnalysis {
  title: string;
  summary: string;
  activity?: string | null;
  location?: string | null;
  mood: string[];
  tags: string[];
  filename: string;
  confidence: {
    activity: number;
    location: number;
    mood: number;
  };
}

export interface ExperienceMemoryRecord {
  id: string;
  userId?: string | null;
  title: string;
  summary: string;
  userNote: string;
  activity?: string | null;
  location?: string | null;
  occurredAt: string;
  tags: string[];
  mood: string[];
  driveFileId?: string;
  driveNoteFileId?: string;
  driveUrl: string;
  markdownUrl?: string;
  rawAnalysis: ExperienceAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface SaveExperienceMemoryOutput {
  memoryId: string;
  title: string;
  summary: string;
  tags: string[];
  mood: string[];
  driveUrl: string;
}

export interface SearchMemoryResult {
  id: string;
  title: string;
  summary: string;
  occurredAt: string;
  location?: string | null;
  tags: string[];
  mood: string[];
  driveUrl: string;
  score: number;
}
