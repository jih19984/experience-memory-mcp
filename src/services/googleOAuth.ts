import { google } from "googleapis";
import { createHmac, timingSafeEqual } from "node:crypto";

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

export interface GoogleAuthUrlOptions {
  state?: string;
}

export interface GoogleOAuthState {
  provider: string;
  providerUserId: string;
  redirectUri?: string;
  createdAt: number;
}

export function buildGoogleAuthUrl(config: GoogleOAuthConfig, options: GoogleAuthUrlOptions = {}): string {
  const client = createGoogleOAuthClient(config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_DRIVE_FILE_SCOPE],
    state: options.state
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

export function createGoogleOAuthState(state: Omit<GoogleOAuthState, "createdAt">, key = process.env.TOKEN_ENCRYPTION_KEY): string {
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }
  const payload: GoogleOAuthState = {
    ...state,
    createdAt: Date.now()
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(body, key);
  return `${body}.${signature}`;
}

export function verifyGoogleOAuthState(value: string, key = process.env.TOKEN_ENCRYPTION_KEY): GoogleOAuthState {
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }
  const [body, signature] = value.split(".");
  if (!body || !signature) {
    throw new Error("Invalid Google OAuth state");
  }
  const expected = sign(body, key);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("Invalid Google OAuth state");
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleOAuthState;
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}
