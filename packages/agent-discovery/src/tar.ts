import { gunzipSync, gzipSync } from "node:zlib";

const BLOCK = 512;

export interface ArchiveEntry {
  path: string;
  content: Uint8Array;
}

function octal(value: number, length: number): string {
  return `${value.toString(8).padStart(length - 1, "0")}\0`;
}

function header(path: string, size: number): Uint8Array {
  const bytes = new TextEncoder().encode(path);
  if (bytes.length === 0 || bytes.length > 100) {
    throw new Error(`Archive path is empty or longer than 100 bytes: ${path}`);
  }
  const block = new Uint8Array(BLOCK);
  const write = (offset: number, text: string) => block.set(new TextEncoder().encode(text), offset);
  block.set(bytes, 0);
  write(100, octal(0o644, 8));
  write(108, octal(0, 8));
  write(116, octal(0, 8));
  write(124, octal(size, 12));
  write(136, octal(0, 12));
  write(148, "        ");
  write(156, "0");
  write(257, "ustar\0");
  write(263, "00");
  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  write(148, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return block;
}

/** A gzip-compressed ustar archive with a fixed mtime and mode, sorted by path. */
export function createArchive(entries: ArchiveEntry[]): Buffer {
  const chunks: Uint8Array[] = [];
  for (const entry of [...entries].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    chunks.push(header(entry.path, entry.content.length), entry.content);
    const padding = (BLOCK - (entry.content.length % BLOCK)) % BLOCK;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(BLOCK * 2));
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

/**
 * Read a gzip ustar archive. Rejects any entry a consumer must not extract:
 * absolute paths, `..` segments, and anything that is not a regular file.
 */
export function readArchive(archive: Uint8Array): ArchiveEntry[] {
  const data = gunzipSync(archive);
  const entries: ArchiveEntry[] = [];
  const decoder = new TextDecoder();
  const field = (start: number, length: number, offset: number) =>
    decoder.decode(data.subarray(offset + start, offset + start + length)).replace(/\0.*$/s, "");

  for (let offset = 0; offset + BLOCK <= data.length; ) {
    if (data.subarray(offset, offset + BLOCK).every((byte) => byte === 0)) break;
    const path = field(0, 100, offset);
    const size = Number.parseInt(field(124, 12, offset).trim(), 8);
    const type = field(156, 1, offset) || "0";
    if (type !== "0") throw new Error(`Archive entry ${path} is not a regular file`);
    if (path.startsWith("/") || path.split("/").includes("..")) {
      throw new Error(`Archive entry escapes the skill directory: ${path}`);
    }
    const start = offset + BLOCK;
    entries.push({ path, content: new Uint8Array(data.subarray(start, start + size)) });
    offset = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  return entries;
}
