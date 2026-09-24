/**
 * Rasterizes one PDF page to RGBA pixels, for a decoder that needs a bitmap
 * rather than a pixel-difference metric.
 *
 * Both the default engine and the Chromium adapter can draw a QR code as
 * vector fills rather than an embedded raster image — `readPdf` reports no
 * `paintImageXObject` for either page, only `constructPath` and
 * `setFillRGBColor` — so the only way to prove a QR code decodes on either
 * engine's page is to actually paint the page and read its pixels back.
 *
 * This is the same technique `tests/parity/raster.ts` measures pages with in
 * `@paradoc/react-pdf`: a real Chrome tab paints the page into a `<canvas>`
 * through pdf.js loaded as a blob module, so the same Skia that paints the
 * parity suite's pixels paints these. It is not a second rasterizer — no
 * `canvas` package, no shelled-out tool — it is that technique, pared down to
 * "give me this page's pixels" instead of a comparison against a preview
 * capture, and pointed at a scratch page rather than the parity lab, which
 * this package has no dependency on and no reason to start.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { Browser } from "puppeteer";

const require = createRequire(import.meta.url);

export interface RasterizedPage {
  /** Device pixels wide. */
  width: number;
  /** Device pixels tall. */
  height: number;
  /** RGBA, top-left origin, `width * height * 4` bytes. */
  data: Uint8ClampedArray;
}

/**
 * Paints page `pageNumber` (1-based) of `pdf` at `scale` (device pixels per
 * PDF point) and reads it back as RGBA.
 *
 * A fresh tab per call: this is a one-shot proof, not a suite that amortizes
 * a rasterizer across many pages, so nothing here is cached or shared with a
 * caller's own browser lifecycle beyond the `Browser` it is handed.
 */
export async function rasterizePdfPage(
  browser: Browser,
  pdf: Uint8Array,
  pageNumber: number,
  scale: number
): Promise<RasterizedPage> {
  const page = await browser.newPage();
  try {
    // No lab to start: `about:blank` is an opaque origin, but nothing here
    // needs a real one, only a page a `Blob` URL can be created in and a
    // dynamic `import()` of one can be loaded from — both work from the
    // opaque origin every new tab already has.
    await page.goto("about:blank");

    const library = readFileSync(require.resolve("pdfjs-dist/build/pdf.min.mjs"), "utf8");
    const worker = readFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), "utf8");
    const base64 = Buffer.from(pdf).toString("base64");

    const result = await page.evaluate(rasterizeInPage, library, worker, base64, pageNumber, scale);
    const pixels = Buffer.from(result.pixels, "base64");

    return { width: result.width, height: result.height, data: Uint8ClampedArray.from(pixels) };
  } finally {
    await page.close();
  }
}

/** What the in-page pass reports back: the page's size and its pixels, base64. */
interface RasterResult {
  width: number;
  height: number;
  /**
   * RGBA bytes, base64, so a page's worth of pixels crosses the CDP wire as
   * one string rather than millions of JSON array elements.
   */
  pixels: string;
}

/** The little of pdf.js the in-page pass uses. */
interface PdfjsDocument {
  getPage: (n: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void> };
  }>;
  destroy: () => Promise<void>;
}

/** The little of pdf.js's module shape the blob-loaded `import()` returns. */
interface PdfjsModule {
  getDocument: (options: {
    data: Uint8Array;
    isEvalSupported: boolean;
  }) => { promise: Promise<PdfjsDocument> };
  GlobalWorkerOptions: { workerSrc: string };
}

/**
 * Runs inside the page: loads pdf.js, paints one page into a canvas, and
 * base64-encodes its pixels.
 *
 * One self-contained function, like `raster.ts`'s `measureInPage`:
 * `page.evaluate` sends its source to the page, so it closes over nothing and
 * every name it needs is an argument.
 */
async function rasterizeInPage(
  librarySource: string,
  workerSource: string,
  pdfBase64: string,
  number: number,
  deviceScale: number
): Promise<RasterResult> {
  const script = (source: string) => URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  // Built rather than written as a literal `import()`: this function's source
  // is sent to the page as text, and the bundler that reads it on the way out
  // would otherwise rewrite the import into a call only it can resolve.
  const load = new Function("url", "return import(url)") as (url: string) => Promise<PdfjsModule>;
  const pdfjs = await load(script(librarySource));
  pdfjs.GlobalWorkerOptions.workerSrc = script(workerSource);

  const document_ = await pdfjs.getDocument({
    data: Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0)),
    isEvalSupported: false,
  }).promise;
  try {
    const pdfPage = await document_.getPage(number);
    const viewport = pdfPage.getViewport({ scale: deviceScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("no 2d context");
    // A PDF page paints on paper; a canvas starts transparent.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // `btoa` needs a binary string; chunked, so a full page's worth of bytes
    // never becomes one `String.fromCharCode(...spread)` call that blows the
    // engine's argument limit.
    const CHUNK = 0x8000;
    let binary = "";
    for (let i = 0; i < data.length; i += CHUNK) {
      binary += String.fromCharCode(...data.subarray(i, i + CHUNK));
    }
    return { width: canvas.width, height: canvas.height, pixels: btoa(binary) };
  } finally {
    await document_.destroy();
  }
}
