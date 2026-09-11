/**
 * The font and image bytes the PDF render needs, read from disk.
 *
 * The PDF embeds the exact application font resources recorded by the preview
 * or supplied by a headless caller.
 *
 * Node only. The browser cannot read these paths, which is why `@paradoc/react/pdf`
 * is a separate subpath.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import type { FontLoader } from "takumi-pdf";


const require = createRequire(import.meta.url);

/**
 * One font file, named the way each engine keys a face.
 *
 * An engine that registers faces by name takes `name` and `family`; an engine
 * that is given a stylesheet takes `family`, `weight` and `unicodeRange`. Both
 * read the same `path`, which is the invariant this package is built on: the PDF
 * embeds the file the preview loads.
 */
export interface PdfFontFile {
  /** Registry name, for an engine that keys a face by name rather than family. */
  name: string;
  /** The CSS family the face belongs to. Every face here is one family. */
  family: string;
  /** Absolute path to the file on disk. */
  path: string;
  /** The weights the face carries, in CSS `font-weight` syntax. */
  weight: string;
  /** The codepoints the face covers, in CSS `unicode-range` syntax. */
  unicodeRange?: string;
  /** Face style, in CSS `font-style` syntax. */
  style?: string;
  /** Stable identity of the exact bytes embedded by the renderer. */
  identity?: string;
  /** Exact bytes, retained when the source is not a local file. */
  data?: Uint8Array;
  /** CSS font source format, when known. */
  format?: string;
}

/** One application-owned face made available to a headless PDF render. */
export interface PdfFontResource {
  family: string;
  /** A local path, package specifier, file URL, or reachable HTTP(S) URL. */
  source: string;
  weight?: string;
  style?: string;
  unicodeRange?: string;
  /** Optional expected SHA-256 hex digest. */
  integrity?: string;
  format?: string;
}

export class FontResourceError extends Error {
  constructor(readonly resource: PdfFontResource, message: string, options?: ErrorOptions) {
    super(`Could not resolve font face "${resource.family}" from ${resource.source}: ${message}`, options);
    this.name = "FontResourceError";
  }
}

const resolvedResources = new Map<string, Promise<PdfFontFile>>();

function resourcePath(source: string): string | undefined {
  if (source.startsWith("data:")) return undefined;
  if (source.startsWith("file:")) return new URL(source).pathname;
  if (source.startsWith("http://") || source.startsWith("https://")) return undefined;
  try { return require.resolve(source); } catch { return source; }
}

/** Resolve and cache application font bytes, independently of their provider. */
export function resolveFontResource(resource: PdfFontResource): Promise<PdfFontFile> {
  const key = JSON.stringify(resource);
  let pending = resolvedResources.get(key);
  if (pending === undefined) {
    pending = (async () => {
      const path = resourcePath(resource.source);
      const bytes = resource.source.startsWith("data:")
        ? new Uint8Array(Buffer.from(resource.source.slice(resource.source.indexOf(",") + 1), "base64"))
        : path === undefined ? new Uint8Array(await (async () => {
            const response = await fetch(resource.source);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.arrayBuffer();
          })())
        : new Uint8Array(await readFile(path));
      const identity = createHash("sha256").update(bytes).digest("hex");
      if (resource.integrity !== undefined && resource.integrity !== identity) {
        throw new Error(`SHA-256 integrity mismatch (expected ${resource.integrity}, received ${identity})`);
      }
      return {
        name: `${resource.family} ${identity.slice(0, 12)}`,
        family: resource.family,
        path: path ?? resource.source,
        data: bytes,
        identity,
        weight: resource.weight ?? "400",
        style: resource.style ?? "normal",
        unicodeRange: resource.unicodeRange,
        format: resource.format,
      };
    })().catch((cause: unknown) => {
      resolvedResources.delete(key);
      throw new FontResourceError(resource, cause instanceof Error ? cause.message : String(cause), { cause });
    });
    resolvedResources.set(key, pending);
  }
  return pending;
}

export function resolveFontResources(resources: readonly PdfFontResource[]): Promise<PdfFontFile[]> {
  return Promise.all(resources.map(resolveFontResource));
}

/**
 * The faces one render embeds, as the engine's own loaders.
 *
 * Built from the prepared input's file list rather than resolved again here, so
 * the two adapters cannot embed different files: one is given the list as
 * `@font-face` rules and the other as loaders, and both lists are the same list.
 * Every face is registered as a coverage subset of one logical family, so
 * `font-family: <the document's family>` reaches whichever face covers the text.
 */
export function pdfFonts(files: readonly PdfFontFile[]): Promise<FontLoader[]> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      subsetOf: file.family,
      data: file.data ?? await readFile(file.path),
    }))
  );
}

const MARKER_FONT_FILE =
  "@fontsource/noto-sans-symbols-2/files/noto-sans-symbols-2-braille-400-normal.woff2";
const markerFaces = new Map<string, Promise<PdfFontFile>>();

/** Internal braille coverage used only while locating flow-positioned signature slots. */
export function markerFontFile(family: string): Promise<PdfFontFile> {
  let pending = markerFaces.get(family);
  if (pending === undefined) {
    pending = (async () => {
      const path = require.resolve(MARKER_FONT_FILE);
      const data = new Uint8Array(await readFile(path));
      return {
        name: `${family} signing marker`,
        family,
        path,
        data,
        identity: createHash("sha256").update(data).digest("hex"),
        weight: "400",
        unicodeRange: "U+2800-28FF",
        format: "woff2",
      };
    })().catch((error: unknown) => {
      markerFaces.delete(family);
      throw error;
    });
    markerFaces.set(family, pending);
  }
  return pending;
}

/** An image the engine renders, keyed by the `src` the tree names. */
export interface PdfImage {
  src: string;
  data: Uint8Array;
}

export { imageFormat } from "../lib/image";
