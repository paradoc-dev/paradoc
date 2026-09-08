/**
 * The stylesheet the Chromium adapter prints against.
 *
 * The preview is a Tailwind page compiled by the lab's Vite plugin. A browser
 * printing the same tree needs the same CSS, and there is no bundler in a Node
 * render, so Tailwind is compiled here through its own API from
 * `src/styles.css` — the one stylesheet the package publishes — against the
 * class names the markup actually carries.
 *
 * Three things are added to it and nothing else:
 *
 * 1. `@font-face` rules for the files `resources.ts` names, as `file://` URLs,
 *    and the custom property that selects the document's family.
 *    The package's own stylesheet loads the faces through the bundler with
 *    relative paths, which resolve to nothing in a temporary directory, so they
 *    are restated from the same list rather than imported. The families, weights
 *    and unicode ranges are the fontsource packages' own, and only the family the
 *    document names is restated: a render embeds the faces it uses.
 * 2. The page box. The preview's sheet is 816 x 1056 CSS pixels with a 48 pixel
 *    padding; a printed page is the same size with that 48 as its page margin,
 *    so every page carries it rather than only the first. That is the same
 *    decision the takumi path makes when it passes the margin to the engine
 *    instead of padding the tree.
 * 3. A white ground, because a PDF page is paper and a browser canvas is not.
 *
 * No preflight is restated. Tailwind's own preflight is in the compiled output,
 * which is exactly what the preview has; `PDF_RESET_STYLESHEET` exists because
 * takumi has no preflight at all.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "tailwindcss";

import { FONT_FAMILY_PROPERTY, type DocumentTokens } from "../../lib/tokens";
import type { PdfFontFile } from "../resources";
import type { PdfPageGeometry } from "../adapter";

const require = createRequire(import.meta.url);

/**
 * The package's published stylesheet: the document's one font source.
 *
 * Resolved through the package's own export map rather than relative to this
 * module, which is one file in source and another in the built bundle. The
 * export map names one path from both, and it is the path the preview imports.
 */
const DOCUMENT_STYLES = `
.paradoc-document {
  font-family: var(--paradoc-font-family, "Inter Variable", ui-sans-serif, system-ui, sans-serif);
}
.paradoc-ltr-isolate {
  direction: ltr;
  unicode-bidi: isolate;
}`;

/** CSS pixels per inch, which is what makes 816 x 1056 US Letter. */
const CSS_PIXELS_PER_INCH = 96;

/**
 * A CSS pixel length as the inches a page box takes.
 *
 * The preview states the paper in pixels and a printer states it in inches, and
 * both the stylesheet's `@page` and the print call need the same number, so
 * there is one conversion rather than two.
 */
export function cssPixelsToInches(px: number): string {
  return `${px / CSS_PIXELS_PER_INCH}in`;
}

/**
 * Resolves a stylesheet Tailwind imports.
 *
 * A bare specifier is a package, and a package's CSS entry is what is wanted
 * rather than its JavaScript one: `tailwindcss` resolves to a module through
 * `exports["."]` and to `index.css` through `exports["./index.css"]`, and only
 * the second is a stylesheet.
 */
async function loadStylesheet(id: string, base: string): Promise<{
  path: string;
  base: string;
  content: string;
}> {
  const path = id.startsWith(".") || id.startsWith("/")
    ? resolve(base, id)
    : resolveStylesheetPackage(id);
  return { path, base: dirname(path), content: await readFile(path, "utf8") };
}

/** A package's stylesheet entry, preferring its CSS export over its module. */
function resolveStylesheetPackage(id: string): string {
  try {
    return require.resolve(`${id}/index.css`);
  } catch {
    return require.resolve(id);
  }
}

/**
 * Every class name the markup carries, deduplicated.
 *
 * Tailwind generates a utility only for a candidate it is given, and the
 * markup is the whole of what this render can use. Scanning it rather than the
 * package's source is both narrower and exact: a class that reached the page is
 * a class the page needs, and one that did not cannot affect it.
 */
export function classCandidates(markup: string): string[] {
  const found = new Set<string>();
  for (const match of markup.matchAll(/\sclass="([^"]*)"/gu)) {
    for (const name of match[1]!.split(/\s+/u)) {
      if (name.length > 0) found.add(name);
    }
  }
  return [...found];
}

/** An `@font-face` for one file, at the path the render reads it from. */
function fontFace(font: PdfFontFile): string {
  const lines = [
    `  font-family: "${font.family}";`,
    `  font-style: normal;`,
    // `block` rather than fontsource's `swap`: this page is printed once, and a
    // fallback painted while a face loads would be a silent substitution.
    `  font-display: block;`,
    `  font-weight: ${font.weight};`,
    `  src: url("${pathToFileURL(font.path).href}") format("woff2");`,
  ];
  if (font.unicodeRange !== undefined) lines.push(`  unicode-range: ${font.unicodeRange};`);
  return `@font-face {\n${lines.join("\n")}\n}`;
}

/**
 * The document's family, as the property `styles.css` reads it from.
 *
 * The preview writes the same property on the sheet from the same resolved
 * tokens, so the browser printing this page and the browser drawing the preview
 * select the same faces.
 */
function familyProperty(tokens: DocumentTokens): string {
  return [`.paradoc-document {`, `  ${FONT_FAMILY_PROPERTY}: ${tokens.fontStack};`, `}`].join("\n");
}

/** The page box, in the inches a printer takes and the pixels the preview states. */
function pageBox(geometry: PdfPageGeometry): string {
  return [
    `@page {`,
    `  size: ${cssPixelsToInches(geometry.widthPx)} ${cssPixelsToInches(geometry.heightPx)};`,
    `  margin: ${geometry.marginPx}px;`,
    `}`,
    ``,
    `html, body {`,
    `  margin: 0;`,
    `  padding: 0;`,
    `  background: #ffffff;`,
    `}`,
  ].join("\n");
}

/**
 * The whole stylesheet for one render: Tailwind compiled for this markup, the
 * document's faces, and the page.
 */
export async function chromiumStylesheet(
  markup: string,
  fonts: readonly PdfFontFile[],
  geometry: PdfPageGeometry,
  tokens: DocumentTokens
): Promise<string> {
  const source = `@import "tailwindcss";\n${DOCUMENT_STYLES}`;
  const compiled = await compile(source, { base: process.cwd(), loadStylesheet });

  return [
    compiled.build(classCandidates(markup)),
    fonts.map(fontFace).join("\n\n"),
    familyProperty(tokens),
    pageBox(geometry),
  ].join("\n\n");
}
