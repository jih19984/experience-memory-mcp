import * as z from "zod/v4";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";

export const saveExperienceMemoryInputSchema = {
  imagePath: z.string().optional(),
  imageUrl: z.url().optional(),
  imageBase64: z.string().optional(),
  userNote: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  mood: z.array(z.string().min(1)).optional(),
  activityHint: z.string().optional(),
  occurredAt: z.string().optional(),
  locationHint: z.string().optional()
};

export async function saveExperienceMemory(input: z.infer<z.ZodObject<typeof saveExperienceMemoryInputSchema>>) {
  return (await getConfiguredExperienceMemoryService()).saveExperienceMemory(input);
}
