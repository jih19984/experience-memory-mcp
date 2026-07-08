#!/usr/bin/env node
import "dotenv/config";
import http from "node:http";
import { spawn } from "node:child_process";
import {
  buildGoogleAuthUrl,
  createExperienceMemoryRootFolder,
  DEFAULT_GOOGLE_REDIRECT_URI,
  exchangeGoogleAuthCode
} from "../services/googleOAuth.js";
import { PostgresGoogleConnectionRepository } from "../services/googleConnections.js";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_GOOGLE_REDIRECT_URI;
const actor = parseActorArgs(process.argv.slice(2));

if (!clientId || !clientSecret) {
  console.error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.");
  process.exit(1);
}
if (actor && !process.env.TOKEN_ENCRYPTION_KEY) {
  console.error("TOKEN_ENCRYPTION_KEY is required when saving a Google connection for an actor.");
  process.exit(1);
}

const url = new URL(redirectUri);
if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
  console.error("GOOGLE_REDIRECT_URI must be a localhost URL for this helper.");
  process.exit(1);
}

const config = { clientId, clientSecret, redirectUri };
const authUrl = buildGoogleAuthUrl(config);

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", redirectUri);
    if (requestUrl.pathname !== url.pathname) {
      response.writeHead(404).end("Not found");
      return;
    }

    const code = requestUrl.searchParams.get("code");
    const error = requestUrl.searchParams.get("error");
    if (error) {
      throw new Error(`Google OAuth error: ${error}`);
    }
    if (!code) {
      throw new Error("Google OAuth callback did not include a code");
    }

    const tokens = await exchangeGoogleAuthCode(config, code);
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      throw new Error("Google did not return a refresh token. Revoke app access or use a new account, then try again.");
    }

    const rootFolder = await createExperienceMemoryRootFolder({ ...config, refreshToken });
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
      "<h1>Experience Memory MCP connected</h1><p>You can close this tab and copy the values from your terminal.</p>"
    );

    if (actor) {
      const connections = new PostgresGoogleConnectionRepository();
      const connection = await connections.upsertConnection({
        ...actor,
        refreshToken,
        driveRootFolderId: rootFolder.folderId
      });
      console.log("\nGoogle Drive connected for actor:\n");
      console.log(`${connection.provider}:${connection.providerUserId}`);
      console.log(`userId=${connection.userId}`);
    } else {
      console.log("\nGoogle Drive connected. Add these values to your .env:\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
      console.log(`GOOGLE_DRIVE_ROOT_FOLDER_ID=${rootFolder.folderId}`);
    }
    if (rootFolder.webViewLink) {
      console.log(`\nDrive folder: ${rootFolder.webViewLink}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end(message);
    console.error(message);
  } finally {
    setTimeout(() => server.close(), 250);
  }
});

server.listen(Number(url.port || 80), url.hostname, () => {
  console.log("Open this URL to connect Google Drive:\n");
  console.log(authUrl);
  openBrowser(authUrl);
});

function openBrowser(authUrl: string) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", authUrl] : [authUrl];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => undefined);
  child.unref();
}

function parseActorArgs(args: string[]) {
  const provider = valueAfter(args, "--actor-provider");
  const providerUserId = valueAfter(args, "--actor-id");
  if (!provider && !providerUserId) {
    return undefined;
  }
  if (!provider || !providerUserId) {
    throw new Error("--actor-provider and --actor-id must be provided together");
  }
  return { provider, providerUserId };
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
