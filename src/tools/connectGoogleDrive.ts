import * as z from "zod/v4";
import {
  buildGoogleAuthUrl,
  createGoogleOAuthState,
  DEFAULT_GOOGLE_REDIRECT_URI
} from "../services/googleOAuth.js";
import type { ExperienceActor } from "../services/configuredService.js";

export const connectGoogleDriveInputSchema = {};

export interface ConnectGoogleDriveOptions {
  actor?: ExperienceActor;
  redirectUri?: string;
}

export async function connectGoogleDrive(
  _input: z.infer<z.ZodObject<typeof connectGoogleDriveInputSchema>>,
  options: ConnectGoogleDriveOptions = {}
) {
  if (!options.actor) {
    throw new Error("Cannot connect Google Drive because the MCP host did not provide a user actor header");
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
  }
  const redirectUri = options.redirectUri ?? process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_GOOGLE_REDIRECT_URI;
  const state = createGoogleOAuthState({
    provider: options.actor.provider,
    providerUserId: options.actor.providerUserId,
    redirectUri
  });

  return {
    connected: false,
    authUrl: buildGoogleAuthUrl({ clientId, clientSecret, redirectUri }, { state }),
    instructions: "Open authUrl, approve Google Drive access, then retry saveExperienceMemory."
  };
}
