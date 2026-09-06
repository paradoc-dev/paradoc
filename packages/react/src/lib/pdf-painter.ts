/**
 * Painting a PDF's pages so a packet reads as one scroll.
 *
 * A bundle holds documents this package did not compose: a registry form filled
 * through its official PDF, an annex somebody uploaded. They are already final,
 * so there is no tree to render — the only honest way to put them on screen
 * beside a composition is to paint the pages they actually have.
 *
 * pdf.js does the painting and is an optional peer, not a dependency. A
 * consumer who never shows a PDF part never installs it, and one who does gets
 * an error naming the package rather than a blank frame. The import is dynamic
 * for the same reason: nothing in the browser bundle pays for a viewer it does
 * not use.
 *
 * Pages come back as data URLs rather than canvases. A painted page is then an
 * `<img>` the preview lays out like anything else, React owns the DOM, and a
 * page that has been painted is visible to a test and to a person reading the
 * document.
 *
 * **Nothing here may hang.** pdf.js waits on the network for two asset sets it
 * does not bundle, the standard fourteen fonts and the CMaps, and a page that
 * needs one and cannot reach it stalls rather than failing. So the caller
 * passes `standardFontDataUrl` and `cMapUrl`, and the whole paint is bounded by
 * `timeoutMs` regardless: a preview that shows an attachment card is a preview,
 * and one that never resolves is a bug that looks like a slow machine.
 *
 * pdf.js's own verbosity is left at its default, so its warnings reach the
 * console rather than being swallowed here.
 */

/** Thrown when pdf.js is not installed. */
export class MissingPdfPainterError extends Error {
  constructor(cause?: unknown) {
    super(
      "Cannot paint a PDF: `pdfjs-dist` is not installed. It is an optional peer of @paradoc/react, " +
        "needed only to show a PDF part of a bundle on screen. Install it, or render that part as an attachment.",
      cause === undefined ? undefined : { cause }
    );
    this.name = "MissingPdfPainterError";
  }
}

/** Thrown when the content is not a PDF a reader can open, or painting it did not finish. */
export class UnpaintablePdfError extends Error {
  constructor(detail: string, cause?: unknown) {
    super(`Cannot paint a PDF: ${detail}`, cause === undefined ? undefined : { cause });
    this.name = "UnpaintablePdfError";
  }
}

/** One page of a PDF, painted. */
export interface PaintedPdfPage {
  /** 1-based page number within its own document. */
  pageNumber: number;
  /** The page's own width in CSS pixels. */
  widthPx: number;
  /** The page's own height in CSS pixels. */
  heightPx: number;
  /** The painted page, as a PNG data URL. */
  src: string;
}

/** How the pages are painted. */
export interface PaintPdfOptions {
  /**
   * Where pdf.js loads its worker from.
   *
   * Leave it unset and the painter loads pdf.js's worker module into the page
   * itself, which paints on the main thread and needs no URL. A host that has
   * a worker URL its bundler produced should pass it: painting then happens off
   * the main thread and a long document does not block the preview.
   */
  workerSrc?: string;
  /**
   * Where pdf.js loads the standard fourteen fonts from, with a trailing slash.
   *
   * A PDF that names Helvetica rather than embedding it needs these. Without
   * the URL pdf.js reports a missing standard font and a page can wait on it,
   * which is a stall rather than a failure. Serve `pdfjs-dist/standard_fonts/`
   * the way the worker is served.
   */
  standardFontDataUrl?: string;
  /**
   * Where pdf.js loads its CMaps from, with a trailing slash. Needed by a PDF
   * using a predefined CJK encoding. Serve `pdfjs-dist/cmaps/`.
   */
  cMapUrl?: string;
  /**
   * CSS pixels per PDF point. Defaults to 96/72, the ratio that makes a US
   * Letter page 816 pixels wide, which is the width this package's own paper is.
   */
  scale?: number;
  /** How many device pixels are painted per CSS pixel. Defaults to 2. */
  resolution?: number;
  /**
   * How long the whole paint may take before it is abandoned, in milliseconds.
   * Defaults to 20000. The document is destroyed when it arrives late, but a
   * pdf.js task already in flight is not interruptible: the point of the bound
   * is that the caller stops waiting, not that pdf.js stops working.
   */
  timeoutMs?: number;
}

/** CSS pixels per PDF point. */
const CSS_PIXELS_PER_POINT = 96 / 72;

/** How long the whole paint may take before the caller stops waiting. */
const DEFAULT_TIMEOUT_MS = 20_000;

interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(parameters: {
    data: Uint8Array;
    isEvalSupported: boolean;
    standardFontDataUrl?: string;
    cMapUrl?: string;
    cMapPacked?: boolean;
  }): { promise: Promise<PdfJsDocument>; destroy(): Promise<void> };
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  destroy(): Promise<void>;
}

interface PdfJsPage {
  getViewport(parameters: { scale: number }): { width: number; height: number };
  render(parameters: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

/**
 * True when the failure is the package not being there.
 *
 * Every other load failure is a real one — a bundler that could not fetch the
 * chunk, a module that threw while initializing — and reporting it as "not
 * installed" would send the reader to install something they already have.
 */
function isModuleMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /Cannot find (module|package)|Failed to resolve (module|import)|Missing "\.\/build/.test(message);
}

/** pdf.js, with a worker it can reach. */
async function loadPdfjs(workerSrc: string | undefined): Promise<PdfJsModule> {
  let pdfjs: PdfJsModule;
  try {
    pdfjs = (await import("pdfjs-dist")) as unknown as PdfJsModule;
  } catch (error) {
    if (isModuleMissing(error)) throw new MissingPdfPainterError(error);
    throw new UnpaintablePdfError(
      `loading pdfjs-dist failed: ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
  if (workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    return pdfjs;
  }
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // Importing the worker module registers it on the global, which is how
    // pdf.js runs without one. Painting then costs main-thread time, which is
    // the trade a caller who passed no worker URL has already made.
    try {
      await import("pdfjs-dist/build/pdf.worker.mjs");
    } catch (error) {
      if (isModuleMissing(error)) throw new MissingPdfPainterError(error);
      throw new UnpaintablePdfError(
        `loading pdf.js's worker failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }
  return pdfjs;
}

/** Every page of the document, painted. */
async function paint(bytes: Uint8Array, options: PaintPdfOptions): Promise<PaintedPdfPage[]> {
  const scale = options.scale ?? CSS_PIXELS_PER_POINT;
  const resolution = options.resolution ?? 2;
  const pdfjs = await loadPdfjs(options.workerSrc);

  let document: PdfJsDocument;
  try {
    // pdf.js takes ownership of the buffer it is given, so it gets a copy: the
    // caller's bytes are the packet's and are hashed and sealed elsewhere.
    document = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      ...(options.standardFontDataUrl !== undefined && { standardFontDataUrl: options.standardFontDataUrl }),
      ...(options.cMapUrl !== undefined && { cMapUrl: options.cMapUrl, cMapPacked: true }),
    }).promise;
  } catch (error) {
    throw new UnpaintablePdfError(error instanceof Error ? error.message : String(error), error);
  }

  try {
    const painted: PaintedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: scale * resolution });
      const canvas = globalThis.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new UnpaintablePdfError("this browser gave no 2D canvas context");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      painted.push({
        pageNumber,
        widthPx: viewport.width / resolution,
        heightPx: viewport.height / resolution,
        src: canvas.toDataURL("image/png"),
      });
    }
    return painted;
  } finally {
    await document.destroy();
  }
}

/**
 * Paint every page of a PDF, within a bound.
 *
 * @throws {MissingPdfPainterError} when pdf.js is not installed.
 * @throws {UnpaintablePdfError} when the bytes are not a PDF a reader opens,
 * when pdf.js could not be loaded, or when the paint did not finish in time.
 */
export async function paintPdfPages(
  bytes: Uint8Array,
  options: PaintPdfOptions = {}
): Promise<PaintedPdfPage[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      paint(bytes, options),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new UnpaintablePdfError(
                `painting did not finish within ${timeoutMs}ms. Two things stall a paint: ` +
                  "`standardFontDataUrl` or `cMapUrl` pointing at nothing, so pdf.js waits on an asset it " +
                  "does not bundle, and a browser with no working raster path, where nothing draws at all."
              )
            ),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
