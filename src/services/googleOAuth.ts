import { google } from "googleapis";

export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DEFAULT_GOOGLE_REDIRECT_URI = "http://localhost:53682/oauth2callback";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export function createGoogleOAuthClient(config: GoogleOAuthConfig) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri ?? DEFAULT_GOOGLE_REDIRECT_URI);
}

export function buildGoogleAuthUrl(config: GoogleOAuthConfig): string {
  const client = createGoogleOAuthClient(config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_DRIVE_FILE_SCOPE]
  });
}

export async function exchangeGoogleAuthCode(config: GoogleOAuthConfig, code: string) {
  const client = createGoogleOAuthClient(config);
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function createExperienceMemoryRootFolder(config: GoogleOAuthConfig & { refreshToken: string }) {
  const auth = createGoogleOAuthClient(config);
  auth.setCredentials({ refresh_token: config.refreshToken });
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.create({
    requestBody: {
      name: "Experience Memories",
      mimeType: "application/vnd.google-apps.folder"
    },
    fields: "id, webViewLink"
  });
  if (!response.data.id) {
    throw new Error("Google Drive root folder creation did not return an id");
  }
  return {
    folderId: response.data.id,
    webViewLink: response.data.webViewLink
  };
}
