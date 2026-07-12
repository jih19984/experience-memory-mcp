import * as z from "zod/v4";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";

export const updateExperienceMemoryInputSchema = {
  id: z.uuid(),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  userNote: z.string().nullable().optional(),
  tags: z.array(z.string().min(1)).min(1).optional(),
  mood: z.array(z.string().min(1)).optional(),
  activityHint: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  locationHint: z.string().nullable().optional()
};

export async function updateExperienceMemory(input: z.infer<z.ZodObject<typeof updateExperienceMemoryInputSchema>>) {
  return (await getConfiguredExperienceMemoryService()).updateExperienceMemory(input);
}
