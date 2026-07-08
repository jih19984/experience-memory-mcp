import * as z from "zod/v4";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";

export const searchExperienceMemoriesInputSchema = {
  query: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(10)
};

export async function searchExperienceMemories(input: z.infer<z.ZodObject<typeof searchExperienceMemoriesInputSchema>>) {
  return (await getConfiguredExperienceMemoryService()).searchExperienceMemories(input);
}
