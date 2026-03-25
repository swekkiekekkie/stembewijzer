import fs from "node:fs/promises";
import path from "node:path";

import type { CoalitionRequestBody } from "./coalitionTypes";
import { coalitionServerCacheFileName, coalitionServerCacheFileNameParts } from "./coalitionCacheKeys";

export function coalitionDiskCacheDir(): string {
  return path.join(process.cwd(), "data", "coalition-cache");
}

export async function readCoalitionDiskCache(
  fileName: string,
): Promise<{ text: string; savedAt: string } | null> {
  const full = path.join(coalitionDiskCacheDir(), fileName);
  try {
    const raw = await fs.readFile(full, "utf8");
    const o = JSON.parse(raw) as { text?: unknown; savedAt?: unknown };
    if (typeof o.text === "string" && typeof o.savedAt === "string") {
      return { text: o.text, savedAt: o.savedAt };
    }
  } catch {
    /* ENOENT, parse */
  }
  return null;
}

export async function readCoalitionDiskCacheForBody(
  body: CoalitionRequestBody,
): Promise<{ text: string; savedAt: string } | null> {
  return readCoalitionDiskCache(coalitionServerCacheFileName(body));
}

export async function writeCoalitionDiskCache(body: CoalitionRequestBody, text: string): Promise<string> {
  const dir = coalitionDiskCacheDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = coalitionServerCacheFileName(body);
  const full = path.join(dir, fileName);
  const savedAt = new Date().toISOString();
  await fs.writeFile(full, JSON.stringify({ text, savedAt }, null, 0), "utf8");
  return savedAt;
}

export async function readCoalitionDiskCacheByQuery(
  gmCode: string,
  statementKey: string,
  fp: string,
): Promise<{ text: string; savedAt: string } | null> {
  const fileName = coalitionServerCacheFileNameParts(gmCode, statementKey, fp);
  return readCoalitionDiskCache(fileName);
}
