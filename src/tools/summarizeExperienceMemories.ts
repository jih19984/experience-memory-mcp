import * as z from "zod/v4";
import { getConfiguredExperienceMemoryService } from "../services/configuredService.js";

export const summarizeExperienceMemoriesInputSchema = {
  period: z.enum(["week", "month", "year", "all"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  theme: z.string().optional()
};

export async function summarizeExperienceMemories(
  input: z.infer<z.ZodObject<typeof summarizeExperienceMemoriesInputSchema>>
) {
  return (await getConfiguredExperienceMemoryService()).summarizeExperienceMemories(input);
}
