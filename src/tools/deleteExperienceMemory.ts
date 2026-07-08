import * as z from "zod/v4";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";

export const deleteExperienceMemoryInputSchema = {
  id: z.uuid()
};

export async function deleteExperienceMemory(input: z.infer<z.ZodObject<typeof deleteExperienceMemoryInputSchema>>) {
  return (await getConfiguredExperienceMemoryService()).deleteExperienceMemory(input);
}
