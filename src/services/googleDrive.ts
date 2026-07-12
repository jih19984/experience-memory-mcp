import { Readable } from "node:stream";
import { google, drive_v3 } from "googleapis";
import type { DriveStorage, DriveUploadResult } from "../types/ports.js";
import { yearMonthPath } from "../utils/date.js";

export interface GoogleDriveConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  rootFolderId?: string;
  rootFolderName?: string;
}

export class GoogleDriveStorage implements DriveStorage {
  private readonly drive: drive_v3.Drive;
  private readonly folderCache = new Map<string, string>();
  private rootFolderId?: string;

  constructor(
    private readonly config: GoogleDriveConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      accessToken: process.env.GOOGLE_ACCESS_TOKEN,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
      rootFolderName: process.env.GOOGLE_DRIVE_ROOT_FOLDER_NAME
    }
  ) {
    if (!config.accessToken && !config.refreshToken) {
      throw new Error("Missing Google Drive configuration: accessToken or refreshToken");
    }
    if (config.refreshToken && (!config.clientId || !config.clientSecret)) {
      throw new Error("Missing Google Drive configuration: clientId, clientSecret");
    }

    const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
    auth.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken
    });
    this.drive = google.drive({ version: "v3", auth });
    this.rootFolderId = config.rootFolderId;
  }

  async uploadPhoto(input: { fileName: string; mimeType: string; buffer: Buffer; occurredAt: string }): Promise<DriveUploadResult> {
    const folderId = await this.ensureDatedFolder("photos", input.occurredAt);
    return this.upload({
      folderId,
      name: input.fileName,
      mimeType: input.mimeType,
      body: Readable.from(input.buffer)
    });
  }

  async uploadMarkdownNote(input: { fileName: string; markdown: string; occurredAt: string }): Promise<DriveUploadResult> {
    const folderId = await this.ensureDatedFolder("notes", input.occurredAt);
    return this.upload({
      folderId,
      name: input.fileName,
      mimeType: "text/markdown",
      body: Readable.from(Buffer.from(input.markdown, "utf8"))
    });
  }

  async exists(fileName: string, occurredAt: string): Promise<boolean> {
    const folderId = await this.ensureDatedFolder("photos", occurredAt);
    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and name = '${escapeDriveQuery(fileName)}' and trashed = false`,
      fields: "files(id)",
      pageSize: 1
    });
    return Boolean(response.data.files?.length);
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.drive.files.delete({ fileId });
  }

  private async upload(input: {
    folderId: string;
    name: string;
    mimeType: string;
    body: Readable;
  }): Promise<DriveUploadResult> {
    const response = await this.drive.files.create({
      requestBody: {
        name: input.name,
        parents: [input.folderId]
      },
      media: {
        mimeType: input.mimeType,
        body: input.body
      },
      fields: "id, webViewLink"
    });
    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Google Drive upload did not return a file id");
    }
    return {
      fileId,
      webViewLink: response.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`
    };
  }

  private async ensureDatedFolder(kind: "photos" | "notes", occurredAt: string): Promise<string> {
    const { year, month } = yearMonthPath(occurredAt);
    const rootFolderId = await this.ensureRootFolder();
    const kindFolder = await this.ensureFolder(kind, rootFolderId);
    const yearFolder = await this.ensureFolder(year, kindFolder);
    return this.ensureFolder(month, yearFolder);
  }

  private async ensureRootFolder(): Promise<string> {
    if (this.rootFolderId) {
      return this.rootFolderId;
    }

    const name = this.config.rootFolderName?.trim() || "Experience Memories";
    const found = await this.drive.files.list({
      q: `'root' in parents and name = '${escapeDriveQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
      pageSize: 1
    });
    const existing = found.data.files?.[0]?.id;
    if (existing) {
      this.rootFolderId = existing;
      return existing;
    }

    const created = await this.drive.files.create({
      requestBody: {
        name,
        parents: ["root"],
        mimeType: "application/vnd.google-apps.folder"
      },
      fields: "id"
    });
    const folderId = created.data.id;
    if (!folderId) {
      throw new Error("Google Drive root folder creation failed");
    }
    this.rootFolderId = folderId;
    return folderId;
  }

  private async ensureFolder(name: string, parentId: string): Promise<string> {
    const cacheKey = `${parentId}/${name}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const found = await this.drive.files.list({
      q: `'${parentId}' in parents and name = '${escapeDriveQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
      pageSize: 1
    });
    const existing = found.data.files?.[0]?.id;
    if (existing) {
      this.folderCache.set(cacheKey, existing);
      return existing;
    }

    const created = await this.drive.files.create({
      requestBody: {
        name,
        parents: [parentId],
        mimeType: "application/vnd.google-apps.folder"
      },
      fields: "id"
    });
    const folderId = created.data.id;
    if (!folderId) {
      throw new Error(`Google Drive folder creation failed: ${name}`);
    }
    this.folderCache.set(cacheKey, folderId);
    return folderId;
  }
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
