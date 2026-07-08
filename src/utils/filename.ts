export function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[/:*?"<>|\\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function buildMemoryBaseName(occurredAt: string, title: string): string {
  const date = occurredAt.slice(0, 10);
  return `${date}_${sanitizeFilenamePart(title || "memory")}`;
}

export async function ensureUniqueName(
  baseName: string,
  extension: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  let suffix = 1;
  while (true) {
    const candidate = `${baseName}${suffix === 1 ? "" : `-${suffix}`}${extension}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
}
