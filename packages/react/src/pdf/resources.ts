/**
 * The font and image bytes the PDF render needs, read from disk.
 *
 * The specification's invariant is that the PDF embeds the same font files the
 * preview loads. `styles.css` loads `@fontsource-variable/inter` through the
 * bundler; this reads the same package's files through Node's resolver, so
 * neither side can name a different family or a different file.
 *
 * Node only. The browser cannot read these paths, which is why `@paradoc/react/pdf`
 * is a separate subpath.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { FontLoader } from "takumi-pdf";

import { DOCUMENT_FONT_NAME, DOCUMENT_FONT_PACKAGE } from "../lib/font";

const require = createRequire(import.meta.url);

/**
 * Every variable Inter face `@fontsource-variable/inter`'s stylesheet loads.
 *
 * The *set* has to match, not the order: a face the preview has and the PDF
 * lacks renders as null glyphs on paper with no error at all, which is exactly
 * the silent loss this package is meant to rule out. Order is immaterial
 * because every face carries its own `unicode-range`, read below from the
 * package's own `unicode.json`, so coverage decides which face a codepoint
 * reaches rather than declaration order does.
 */
const FONT_SUBSETS = [
  "cyrillic-ext",
  "cyrillic",
  "greek-ext",
  "greek",
  "latin-ext",
  "latin",
  "vietnamese",
];

const FONT_FILES = FONT_SUBSETS.map(
  (subset) => `${DOCUMENT_FONT_PACKAGE}/files/inter-${subset}-wght-normal.woff2`
);

/** The weight axis every variable Inter face carries, in CSS syntax. */
const FONT_WEIGHT_RANGE = "100 900";

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
}

/**
 * The coverage the fontsource package declares for each of its subsets.
 *
 * Read from the package's own `unicode.json` rather than restated here, because
 * a face with the wrong range is a face the browser never reaches: seven faces
 * of one family with no ranges at all would leave only the last one usable. The
 * file sits beside the `files` directory the faces themselves come from, which
 * is how it is found without depending on the package exporting it.
 */
async function subsetCoverage(fontFile: string): Promise<Record<string, string>> {
  const json = await readFile(join(dirname(require.resolve(fontFile)), "..", "unicode.json"), "utf8");
  return JSON.parse(json) as Record<string, string>;
}

let fontFiles: Promise<PdfFontFile[]> | undefined;

/**
 * The document typeface as files, resolved once per process.
 *
 * This is the engine-neutral half of the font story: paths and CSS descriptors,
 * with no opinion about how an engine wants the bytes. `documentFonts` reads it
 * for takumi's registry and the Chromium adapter writes `@font-face` rules from
 * the same list, so the two adapters cannot embed different files.
 */
export function documentFontFiles(): Promise<PdfFontFile[]> {
  fontFiles ??= (async () => {
    const coverage = await subsetCoverage(FONT_FILES[0]!);
    return FONT_FILES.map((file, index) => ({
      name: `${DOCUMENT_FONT_NAME} ${index}`,
      family: DOCUMENT_FONT_NAME,
      path: require.resolve(file),
      weight: FONT_WEIGHT_RANGE,
      unicodeRange: coverage[FONT_SUBSETS[index]!],
    }));
  })().catch((error: unknown) => {
    fontFiles = undefined;
    throw error;
  });
  return fontFiles;
}

let fonts: Promise<FontLoader[]> | undefined;

/**
 * The document typeface, loaded once per process. Every face is registered as
 * a coverage subset of one logical family, so `font-family: Inter Variable`
 * reaches whichever face covers the text.
 *
 * A failed read is not cached: one transient error would otherwise poison every
 * later render in the process.
 */
export function documentFonts(): Promise<FontLoader[]> {
  fonts ??= documentFontFiles()
    .then((files) =>
      Promise.all(
        files.map(async (file) => ({
          name: file.name,
          subsetOf: file.family,
          data: await readFile(file.path),
        }))
      )
    )
    .catch((error: unknown) => {
      fonts = undefined;
      throw error;
    });
  return fonts;
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

let markerFaceFile: Promise<PdfFontFile> | undefined;

/**
 * The marker face as a file, resolved once per process.
 *
 * It carries the document family's name rather than its own, for the reason
 * `markerFont` gives: it is a coverage subset of the document family, so the
 * tree still names one font. Its range is the braille block alone, which is
 * what keeps it out of the way of every other glyph on the page.
 */
export function markerFontFile(): Promise<PdfFontFile> {
  markerFaceFile ??= (async () => {
    const coverage = await subsetCoverage(MARKER_FONT_FILE);
    return {
      name: `${DOCUMENT_FONT_NAME} marker`,
      family: DOCUMENT_FONT_NAME,
      path: require.resolve(MARKER_FONT_FILE),
      weight: MARKER_FONT_WEIGHT,
      unicodeRange: coverage[MARKER_FONT_SUBSET],
    };
  })().catch((error: unknown) => {
    markerFaceFile = undefined;
    throw error;
  });
  return markerFaceFile;
}

let markerFace: Promise<FontLoader> | undefined;

/** The marker face, loaded once per process. Only the seal path needs it. */
export function markerFont(): Promise<FontLoader> {
  markerFace ??= markerFontFile()
    .then(async (file) => ({
      name: file.name,
      subsetOf: file.family,
      data: await readFile(file.path),
    }))
    .catch((error: unknown) => {
      markerFace = undefined;
      throw error;
    });
  return markerFace;
}

/** An image the engine renders, keyed by the `src` the tree names. */
export interface PdfImage {
  src: string;
  data: Uint8Array;
}

/**
 * The encodings the engine decodes. Bytes it cannot decode are rejected before
 * the render rather than after, so the error can name the image that is wrong
 * instead of reporting a failure from inside the engine with no source.
 */
const IMAGE_SIGNATURES: readonly { format: string; magic: readonly (number | null)[] }[] = [
  { format: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: "jpeg", magic: [0xff, 0xd8, 0xff] },
  { format: "gif", magic: [0x47, 0x49, 0x46, 0x38] },
  // A RIFF container is only WebP when its form type says so; the same header
  // fronts WAV and AVI, which the engine cannot decode.
  {
    format: "webp",
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
];

/** The encoding of `data`, or `undefined` when the engine cannot decode it. */
export function imageFormat(data: Uint8Array): string | undefined {
  for (const { format, magic } of IMAGE_SIGNATURES) {
    if (magic.every((byte, index) => byte === null || data[index] === byte)) {
      return format;
    }
  }
  // SVG embeds as vectors and arrives as text rather than a binary header.
  const head = new TextDecoder().decode(data.subarray(0, 256)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return "svg";
  return undefined;
}
