import type { Formatter, FormatterProgressivePolicy } from "@paradoc/types";
/**
 * `renderPdf` — one call that turns the composed document into PDF bytes.
 *
 * Node only. The tree it renders is the tree the preview renders — the same
 * components, the same artifact, the same data — so neither output has a
 * template of its own.
 *
 * What the call adds around that tree is only what paper needs and a screen
 * does not: the page geometry the preview already fixes, the font files the
 * preview already loads, and the bytes of images an engine will not fetch.
 * That much is the same whichever engine writes the file, so it is assembled
 * here once and handed to an adapter as `PreparedPdfInput`.
 *
 * **Two adapters, one call.** `takumi` is the default and is the engine the
 * parity suite measures: WebAssembly layout, no browser process. `chromium` prints the
 * same document through the browser that draws the preview. Choosing one is an
 * option, not a second function, because a document that needs a different
 * renderer is still the same document. The Chromium adapter is reached through
 * a dynamic import, so a caller who never names it never loads a browser driver.
 *
 * Anything an engine cannot express fails with every offender named. The
 * preview is more permissive than the PDF, so a document that looks right on
 * screen can still be wrong on paper; saying so is the point.
 *
 * It lives beside `index.ts` rather than in it because `seal.tsx` calls it and
 * `index.ts` re-exports `seal.tsx`; a module that is both the package entry and
 * a dependency of what it exports is a cycle.
 */

import type { ReactNode } from "react";

import { documentTokensOf } from "../lib/document-tokens";
import { scriptOf } from "../lib/script";
import { pageGeometry, type DocumentTokensInput } from "../lib/tokens";
import {
  assertDirectionSupported,
  type PdfAdapter,
  type PdfAdapterName,
  type PdfRenderResult,
  type PreparedPdfInput,
} from "./adapter";
import { takumiAdapter } from "./adapters/takumi";
import { documentFontFiles, markerFontFile, resolveFontResources, type PdfFontResource, type PdfImage } from "./resources";
import { withDrawnPaper, withPartialValues, withTokenOverride, withFormatter } from "./token-override";
import type { PageBreakPlan } from "./tree";

export {
  assertDirectionSupported,
  UnsupportedDirectionError,
  UnsupportedPdfContentError,
  type PdfAdapter,
  type PdfAdapterName,
  type PdfAdapterOptions,
  type PdfPageGeometry,
  type PdfRenderResult,
  type PreparedPdfInput,
} from "./adapter";

export interface RenderPdfOptions {
  /** Application-owned font faces shared by headless renders. */
  fonts?: readonly PdfFontResource[];
  /** The relevant compiled application CSS for browser-backed fidelity rendering. */
  applicationCss?: string;
  formatter?: Formatter;
  progressive?: FormatterProgressivePolicy;
  /**
   * Which engine writes the bytes. Pass an adapter object to supply an engine
   * directly. `takumi` is the default and is what parity is measured on.
   */
  adapter?: PdfAdapterName | PdfAdapter;
  /**
   * Pre-fetched bytes for every image the tree names. No engine here fetches
   * anything, so an image with no entry fails the render.
   */
  images?: readonly PdfImage[];
  /**
   * The preview's page plan: where each page starts, and the table header each
   * one carries above its first row. Absent, the engine paginates on its own.
   */
  plan?: PageBreakPlan;
  /**
   * Tenant branding for this render alone: typeface, accent colour, paper,
   * mark, and the script the document is written in. It is the last layer over
   * whatever the document declares, so a render that changes only the accent
   * keeps the paper the document chose.
   */
  tokens?: DocumentTokensInput;
  /**
   * Renders a document that is still being filled, so a value the data has not
   * finished supplying prints blank instead of failing the render. Off by
   * default, and the seal never sets it: a finished document with a hole in it
   * is a bug, and an em dash would hide it. A value that is wrong rather than
   * unfinished still fails either way.
   */
  partial?: boolean;
  /**
   * Embeds the face that carries the core seal flow's invisible marker
   * codepoints. Only the seal path sets it: without the face the engine writes
   * the marker as nulls and the placement locator cannot find the slot, and
   * with it a render that carries no marker is unchanged.
   */
  signingMarkers?: boolean;
}

/**
 * The optional peers only the Chromium adapter needs, and what each is for.
 *
 * They are peers rather than dependencies because the adapter is experimental:
 * a caller who never names it should not install a browser driver and a CSS
 * compiler to render a PDF.
 */
const CHROMIUM_PEERS = ["puppeteer", "tailwindcss"] as const;

/** Thrown when the Chromium adapter is asked for and its optional peers are not installed. */
export class MissingAdapterPeerError extends Error {
  /** The adapter that could not be loaded. */
  readonly adapter: PdfAdapterName;
  /** The optional peer dependencies that adapter needs. */
  readonly peers: readonly string[];

  constructor(adapter: PdfAdapterName, peers: readonly string[], cause: unknown) {
    super(
      `The "${adapter}" PDF adapter could not be loaded. It needs the optional peer ` +
        `${peers.length === 1 ? "dependency" : "dependencies"} ${peers.join(" and ")}, ` +
        `install them with @paradoc/react-pdf, or run \`npm install ${peers.join(" ")}\` ` +
        "(or the equivalent for your package manager). " +
        `The loader said: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause }
    );
    this.name = "MissingAdapterPeerError";
    this.adapter = adapter;
    this.peers = peers;
  }
}

/**
 * The engine a name asks for, loaded only when it is asked for.
 *
 * A failed load is translated rather than passed on. Node reports a missing
 * optional peer as `Cannot find package 'tailwindcss'` from inside whichever
 * chunk happened to import it, which names neither the adapter that wanted it
 * nor the other peer the caller will need next. One error names both.
 *
 * @throws {MissingAdapterPeerError} when the adapter's optional peers are absent.
 */
async function resolveAdapter(name: PdfAdapterName | PdfAdapter): Promise<PdfAdapter> {
  if (typeof name !== "string") return name;
  if (name === "takumi") return takumiAdapter;
  try {
    const { chromiumAdapter } = await import("./adapters/chromium");
    return chromiumAdapter;
  } catch (error) {
    throw new MissingAdapterPeerError(name, CHROMIUM_PEERS, error);
  }
}

/**
 * Renders a composed document to PDF.
 *
 * The page is the paper the document's own tokens chose — US Letter with a 48
 * pixel margin when they choose nothing — stated in the CSS pixels the preview
 * lays out in, so a page of PDF holds exactly the content a page of preview
 * holds. The tokens are read from the document rather than restated here, and
 * `options.tokens` is a layer over them rather than a second opinion. The margin
 * belongs to the page rather than to the tree: padding on the tree would only
 * indent the first page, and every page carries the same margin.
 *
 * @throws {RootTokenMismatchError} when the document root resolves a paper or a
 * typeface this render did not, which is what a composition that hides its own
 * tokens from the element walk produces.
 * @throws {UnregisteredFontFamilyError} when the document names a family this
 * package carries no files for. A family the engine cannot embed would be
 * written as null glyphs rather than as a fallback.
 * @throws {UnsupportedScriptError} when the family it does name carries no
 * glyphs for the script the document's language is written in, which is the
 * same loss one level down.
 * @throws {UnsupportedDirectionError} when the chosen engine does not lay out
 * the direction the document is written in, naming the adapter and the script.
 * @throws {UnsupportedPdfContentError} when the tree uses a class or an image
 * the chosen engine cannot express. Every offender is listed in one error.
 */
export async function renderPdf(
  element: ReactNode,
  options: RenderPdfOptions = {}
): Promise<PdfRenderResult> {
  const signingMarkers = options.signingMarkers ?? false;
  // Read off the element, synchronously, by the same function the preview's
  // furniture uses. Nothing is rendered to find out: see `lib/document-tokens.ts`.
  // Resolving them is what checks them: a family with no glyphs for the
  // document's script fails here, before an engine is even chosen, because that
  // refusal is the same one whichever engine would have been asked.
  const tokens = documentTokensOf(element, options.tokens);

  const fonts = options.fonts === undefined
    ? [...(await documentFontFiles(tokens.fontFamily))]
    : [...(await resolveFontResources(options.fonts))];
  if (signingMarkers) fonts.push(await markerFontFile(tokens.fontFamily));

  const input: PreparedPdfInput = {
    // The override goes on first so the document resolves it, and what this
    // render resolved goes on outside it so the document can check itself
    // against it. Both are contexts and neither emits markup, so the tree an
    // engine lays out is the tree the caller wrote.
    element: withDrawnPaper(
      withTokenOverride(withPartialValues(withFormatter(element, options), options.partial), options.tokens),
      tokens
    ),
    tokens,
    plan: options.plan,
    images: options.images ?? [],
    fonts,
    applicationCss: options.applicationCss,
    geometry: pageGeometry(tokens),
  };

  const adapter = await resolveAdapter(options.adapter ?? "takumi");
  // The engine, which is the question this render alone asks: whether the one
  // chosen lays the document's direction out at all.
  assertDirectionSupported(adapter, tokens.dir, scriptOf(tokens.lang), tokens.lang);
  return adapter.render(input, { lang: tokens.lang, dir: tokens.dir, signingMarkers });
}
