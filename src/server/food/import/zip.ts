/**
 * Minimal, dependency-free ZIP reader (stored + deflate, no ZIP64/encryption): enough for
 * the USDA FoodData Central CSV bundles. Entries are streamed to disk.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createInflateRaw } from "node:zlib";

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export async function listZipEntries(zipPath: string): Promise<ZipEntry[]> {
  const fh = await open(zipPath, "r");
  try {
    const { size } = await fh.stat();
    const tailLen = Math.min(size, 0xffff + 22);
    const tail = Buffer.alloc(tailLen);
    await fh.read(tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error(`Not a zip file: ${zipPath}`);
    const count = tail.readUInt16LE(eocd + 10);
    const cdSize = tail.readUInt32LE(eocd + 12);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff) throw new Error("ZIP64 archives are not supported");
    const cd = Buffer.alloc(cdSize);
    await fh.read(cd, 0, cdSize, cdOffset);
    const entries: ZipEntry[] = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== CEN_SIG) throw new Error("Corrupt zip central directory");
      const method = cd.readUInt16LE(p + 10);
      const compressedSize = cd.readUInt32LE(p + 20);
      const uncompressed = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const localHeaderOffset = cd.readUInt32LE(p + 42);
      const name = cd.toString("utf8", p + 46, p + 46 + nameLen);
      entries.push({ name, method, compressedSize, size: uncompressed, localHeaderOffset });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    await fh.close();
  }
}

async function dataOffset(zipPath: string, entry: ZipEntry): Promise<number> {
  const fh = await open(zipPath, "r");
  try {
    const header = Buffer.alloc(30);
    await fh.read(header, 0, 30, entry.localHeaderOffset);
    if (header.readUInt32LE(0) !== LOC_SIG) throw new Error(`Corrupt local header for ${entry.name}`);
    return entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  } finally {
    await fh.close();
  }
}

/**
 * Extracts entries whose basename passes `filter` into `destDir` (flattened: only the basename
 * is used, which also prevents path traversal). Returns the written file paths.
 */
export async function extractZip(
  zipPath: string,
  destDir: string,
  filter: (basename: string) => boolean = () => true,
): Promise<string[]> {
  await mkdir(destDir, { recursive: true });
  const written: string[] = [];
  for (const entry of await listZipEntries(zipPath)) {
    if (entry.name.endsWith("/")) continue;
    const base = path.basename(entry.name);
    if (!base || !filter(base)) continue;
    if (entry.method !== 0 && entry.method !== 8) throw new Error(`Unsupported compression ${entry.method}`);
    const start = await dataOffset(zipPath, entry);
    const out = path.join(destDir, base);
    const source = createReadStream(zipPath, { start, end: start + entry.compressedSize - 1 });
    if (entry.compressedSize === 0) {
      await pipeline(source, createWriteStream(out));
    } else if (entry.method === 8) {
      await pipeline(source, createInflateRaw(), createWriteStream(out));
    } else {
      await pipeline(source, createWriteStream(out));
    }
    written.push(out);
  }
  return written;
}
