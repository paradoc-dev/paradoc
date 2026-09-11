/**
 * The font and image bytes the PDF render needs, read from disk.
 *
 * The specification's invariant is that the PDF embeds the same font files the
 * preview loads. `styles.css` loads every registered family through the bundler;
 * this reads the same packages' files through Node's resolver, from the same
 * registrations in `src/lib/font.ts`, so neither side can name a different
 * family or a different file.
 *
 * Node only. The browser cannot read these paths, which is why `@paradoc/react/pdf`
 * is a separate subpath.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { FontLoader } from "takumi-pdf";

import { documentFontFamily, DOCUMENT_FONT_NAME } from "../lib/font";

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
}

export class FontResourceError extends Error {
  constructor(readonly resource: PdfFontResource, message: string, options?: ErrorOptions) {
    super(`Could not resolve font face "${resource.family}" from ${resource.source}: ${message}`, options);
    this.name = "FontResourceError";
  }
}

const resolvedResources = new Map<string, Promise<PdfFontFile>>();

function resourcePath(source: string): string | undefined {
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
      const bytes = path === undefined
        ? new Uint8Array(await (async () => {
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
 * The coverage a fontsource package declares for each of its subsets.
 *
 * Read from the package's own `unicode.json` rather than restated here, because
 * a face with the wrong range is a face the browser never reaches: several faces
 * of one family with no ranges at all would leave only the last one usable. The
 * file sits beside the `files` directory the faces themselves come from, which
 * is how it is found without depending on the package exporting it.
 */
async function subsetCoverage(fontFile: string): Promise<Record<string, string>> {
  const json = await readFile(join(dirname(require.resolve(fontFile)), "..", "unicode.json"), "utf8");
  return JSON.parse(json) as Record<string, string>;
}

const fontFiles = new Map<string, Promise<PdfFontFile[]>>();

/**
 * One family as files, resolved once per family per process.
 *
 * This is the engine-neutral half of the font story: paths and CSS descriptors,
 * with no opinion about how an engine wants the bytes. `pdfFonts` turns it into
 * takumi's registry and the Chromium adapter writes `@font-face` rules from the
 * same list, so the two adapters cannot embed different files.
 *
 * A failed read is not cached: one transient error would otherwise poison every
 * later render in the process.
 *
 * @throws {UnregisteredFontFamilyError} when the family carries no files here.
 */
export function documentFontFiles(family: string = DOCUMENT_FONT_NAME): Promise<PdfFontFile[]> {
  const registration = documentFontFamily(family);
  let files = fontFiles.get(family);
  if (files === undefined) {
    files = (async () => {
      const coverage = await subsetCoverage(registration.file(registration.subsets[0]!));
      return registration.subsets.map((subset, index) => ({
        name: `${registration.name} ${index}`,
        family: registration.name,
        path: require.resolve(registration.file(subset)),
        weight: registration.weight,
        unicodeRange: coverage[subset],
      }));
    })().catch((error: unknown) => {
      fontFiles.delete(family);
      throw error;
    });
    fontFiles.set(family, files);
  }
  return files;
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

/**
 * The file that carries the seal flow's marker codepoints.
 *
 * Core places a flow-positioned signature slot by writing eight braille
 * codepoints in front of the placeholder and finding them again in the
 * converted PDF's text. The encoding is base 4, so the eight are drawn from
 * four values: U+2800, U+2801, U+2802 and U+2804. The engine writes U+0000 for any codepoint the
 * embedded fonts do not cover, and Inter covers no braille, so without this file
 * the marker reaches the PDF as eight nulls and the locator reports the slot
 * missing. Registered as a coverage subset of the document family, so the tree
 * still names one font and nothing about the document's typography changes.
 */
const MARKER_FONT_FILE =
  "@fontsource/noto-sans-symbols-2/files/noto-sans-symbols-2-braille-400-normal.woff2";

/** The subset of the marker package the file above is, as its coverage is keyed. */
const MARKER_FONT_SUBSET = "braille";

/** The one weight the marker face carries. */
const MARKER_FONT_WEIGHT = "400";

const markerFaceFiles = new Map<string, Promise<PdfFontFile>>();

/**
 * The marker face as a file, resolved once per document family per process.
 *
 * It carries the document family's name rather than its own: it is a coverage
 * subset of whichever family the document is set in, so the tree still names one
 * font. Its range is the braille block alone, which is what keeps it out of the
 * way of every other glyph on the page.
 */
export function markerFontFile(family: string = DOCUMENT_FONT_NAME): Promise<PdfFontFile> {
  const registration = documentFontFamily(family);
  let file = markerFaceFiles.get(family);
  if (file === undefined) {
    file = (async () => {
      const coverage = await subsetCoverage(MARKER_FONT_FILE);
      return {
        name: `${registration.name} marker`,
        family: registration.name,
        path: require.resolve(MARKER_FONT_FILE),
        weight: MARKER_FONT_WEIGHT,
        unicodeRange: coverage[MARKER_FONT_SUBSET],
      };
    })().catch((error: unknown) => {
      markerFaceFiles.delete(family);
      throw error;
    });
    markerFaceFiles.set(family, file);
  }
  return file;
}

/** An image the engine renders, keyed by the `src` the tree names. */
export interface PdfImage {
  src: string;
  data: Uint8Array;
}

export { imageFormat } from "../lib/image";
