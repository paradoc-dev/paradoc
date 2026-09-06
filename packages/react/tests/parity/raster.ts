/**
 * The PDF side of the comparison, and the comparison itself.
 *
 * Both happen in the same browser that drew the preview, and that is the point.
 * Comparing a screenshot from one rasterizer against a bitmap from another
 * measures the two rasterizers as much as it measures the two documents. Chrome
 * paints the preview; pdf.js paints the PDF into a canvas in the same Chrome; so
 * the same Skia turns outlines into pixels on both sides and what is left is the
 * layout.
 *
 * pdf.js is loaded as a blob module rather than fetched from the lab. The lab is
 * a dev server for one application and pdf.js is not part of it, so the file the
 * suite reads off disk is handed to the page directly, worker included.
 *
 * The metric the specification names is the one reported: the share of a page's
 * pixels that differ after conversion to grayscale, at the paper's own
 * resolution. Three more numbers travel with it, because that share alone cannot
 * be read. `ink` says how much of the page is not blank, which is the ceiling a
 * text page's difference is measured against. `shiftFloor` is the preview
 * compared with itself moved down one pixel, which is what a single pixel of
 * drift costs in this metric. `aligned` and `drift` re-measure the page after
 * letting each horizontal band slide vertically, which separates a difference
 * that is the two layouts disagreeing from a difference that is one of them
 * sitting slightly lower.
 */

import type { Browser, Page } from "puppeteer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PAPER_HEIGHT_PX, PAPER_WIDTH_PX } from "../../src/components/paper";

const require = createRequire(import.meta.url);

/**
 * How far a grayscale value may move before the pixel counts as different, out
 * of 255. Two rasterizers never agree to the last level on an antialiased edge;
 * a pixel that moved by less than an eighth of the range has not changed what
 * the page looks like.
 */
export const DIFFERENCE_TOLERANCE = 32;

/** Height of the bands the alignment pass slides, in pixels. */
const BAND_HEIGHT = 48;

/**
 * How far a band may slide when the alignment pass looks for its counterpart.
 *
 * Wider than the eight pixels a page is allowed to drift, or the search would
 * clamp at the limit and the limit could never be exceeded. Well short of half
 * a table row's 36 pixel pitch, or a band could match the wrong row and report
 * a small drift for a page that is a whole row out.
 */
const MAX_DRIFT = 12;

/** Everything measured about one page pair. */
export interface PageDifference {
  /** 1-based page number. */
  number: number;
  /** Pixels compared. */
  totalPixels: number;
  /** Preview pixels that are not blank. */
  inkPixels: number;
  /** Pixels differing by more than the tolerance. */
  differingPixels: number;
  /** Pixels differing at all, before the tolerance. */
  strictDifferingPixels: number;
  /** What one pixel of vertical drift costs, measured on the preview alone. */
  shiftFloorPixels: number;
  /** Pixels still differing once each band is allowed to slide vertically. */
  alignedPixels: number;
  /** The largest vertical slide any band needed, in pixels. */
  driftPixels: number;
  /**
   * True when an inked band's best match sat at the very edge of the search.
   * The reported drift is then a floor, not a measurement: the real offset is
   * at least that and the search could not see how much more.
   */
  driftSaturated: boolean;
  /** A picture of the difference: the preview in gray, differing pixels in red. */
  image: string;
}

/** A page pair the PDF has and the preview does not, or the other way round. */
export interface MissingPage {
  number: number;
  side: "preview" | "pdf";
}

/** The comparison of one PDF against one set of preview captures. */
export interface Difference {
  pdfPageCount: number;
  previewPageCount: number;
  pages: PageDifference[];
  missing: MissingPage[];
}

/** The rasterizer page, and what it can be asked. */
export interface Rasterizer {
  page: Page;
  /** Rasterizes every page of `pdf` and measures it against the preview captures. */
  compare: (pdf: Uint8Array, previews: readonly string[]) => Promise<Difference>;
}

/** Base64 for bytes, without going through a Buffer in the page. */
function encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Opens a page on the lab's origin and loads pdf.js into it.
 *
 * The origin matters only because a blob module and a blob worker need a real
 * one; nothing about the lab's application is used here.
 */
export async function openRasterizer(browser: Browser, labUrl: string): Promise<Rasterizer> {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
  await page.goto(labUrl, { waitUntil: "domcontentloaded" });

  const library = readFileSync(require.resolve("pdfjs-dist/build/pdf.min.mjs"), "utf8");
  const worker = readFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), "utf8");

  await page.evaluate(
    async (librarySource: string, workerSource: string) => {
      const script = (source: string) =>
        URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      // The import is built rather than written. This function's source is
      // handed to the page as text, and the bundler that reads it on the way
      // out rewrites a literal `import()` into a call only it can resolve.
      const load = new Function("url", "return import(url)") as (
        url: string
      ) => Promise<{ GlobalWorkerOptions: { workerSrc: string } }>;
      const pdfjs = await load(script(librarySource));
      pdfjs.GlobalWorkerOptions.workerSrc = script(workerSource);
      (globalThis as unknown as { pdfjs: unknown }).pdfjs = pdfjs;
    },
    library,
    worker
  );

  const compare = async (pdf: Uint8Array, previews: readonly string[]): Promise<Difference> => {
    // Shown, because a browser gives a hidden tab no frames and rendering a PDF
    // page into a canvas is rendering.
    await page.bringToFront();
    return page.evaluate(measureInPage, encode(pdf), [...previews], {
      width: PAPER_WIDTH_PX,
      height: PAPER_HEIGHT_PX,
      tolerance: DIFFERENCE_TOLERANCE,
      band: BAND_HEIGHT,
      maxDrift: MAX_DRIFT,
    });
  };

  return { page, compare };
}

/** Geometry and thresholds the in-page pass needs, since it shares no scope. */
interface MeasureSettings {
  width: number;
  height: number;
  tolerance: number;
  band: number;
  maxDrift: number;
}

/**
 * Runs inside the browser.
 *
 * It is one self-contained function on purpose: `page.evaluate` sends the source
 * of this function to the page, so it can close over nothing. Both sides are
 * drawn at the capture's own device resolution and averaged down to the paper
 * size, which is where the comparison is defined.
 */
async function measureInPage(
  pdfBase64: string,
  previews: string[],
  settings: MeasureSettings
): Promise<Difference> {
  const { width, height, tolerance, band, maxDrift } = settings;
  /** Ink a band needs before its best offset is treated as a measurement. */
  const INK_BAND_MINIMUM = 50;
  const pdfjs = (globalThis as unknown as { pdfjs: PdfjsLike }).pdfjs;

  /** A white canvas, because a PDF page paints on paper and a canvas starts clear. */
  const sheet = (w: number, h: number): CanvasRenderingContext2D => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("no 2d context");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, w, h);
    return context;
  };

  /** Grayscale at the paper size, averaging each `factor` square down to one pixel. */
  const grayscale = (
    data: Uint8ClampedArray,
    w: number,
    h: number,
    factor: number
  ): Uint8ClampedArray => {
    const out = new Float64Array(width * height);
    for (let y = 0; y < h; y++) {
      const row = Math.floor(y / factor) * width;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const cell = row + Math.floor(x / factor);
        out[cell] = out[cell]! + data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      }
    }
    const per = factor * factor;
    const flat = new Uint8ClampedArray(width * height);
    for (let i = 0; i < out.length; i++) flat[i] = Math.round(out[i]! / per);
    return flat;
  };

  const loadImage = (png: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("a preview capture did not decode"));
      image.src = `data:image/png;base64,${png}`;
    });

  const document_ = await pdfjs.getDocument({
    data: Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0)),
    isEvalSupported: false,
  }).promise;

  const pages: PageDifference[] = [];
  const missing: MissingPage[] = [];
  const pdfPageCount = document_.numPages;

  try {
    for (let number = 1; number <= Math.max(pdfPageCount, previews.length); number++) {
      if (number > pdfPageCount) {
        missing.push({ number, side: "pdf" });
        continue;
      }
      if (number > previews.length) {
        missing.push({ number, side: "preview" });
        continue;
      }

      // The preview capture fixes the resolution both sides are drawn at: it was
      // taken at some device scale factor, and the PDF is rasterized to match.
      const image = await loadImage(previews[number - 1]!);
      const factor = Math.round(image.width / width);
      const deviceWidth = width * factor;
      const deviceHeight = height * factor;

      // A capture that is not a whole multiple of the paper would be resampled
      // by the draw below, and a resample on one side only is a blur the
      // comparison would report as a difference. Refuse rather than measure it.
      if (image.width !== deviceWidth || image.height !== deviceHeight) {
        throw new Error(
          `page ${number}: the preview capture is ${image.width}x${image.height}, ` +
            `not ${deviceWidth}x${deviceHeight}`
        );
      }

      const pdfPage = await document_.getPage(number);
      const unit = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: deviceWidth / unit.width });
      // The PDF page is scaled to the capture's width. If its height does not
      // land on the capture's height, the two sheets are not the same shape and
      // nothing below this line means anything.
      if (Math.round(viewport.height) !== deviceHeight) {
        throw new Error(
          `page ${number}: the PDF page is ${unit.width}x${unit.height} pt, which scales to ` +
            `${deviceWidth}x${Math.round(viewport.height)} against the preview's ` +
            `${deviceWidth}x${deviceHeight}`
        );
      }
      const pdfContext = sheet(deviceWidth, deviceHeight);
      await pdfPage.render({ canvasContext: pdfContext, viewport }).promise;
      const pdf = grayscale(
        pdfContext.getImageData(0, 0, deviceWidth, deviceHeight).data,
        deviceWidth,
        deviceHeight,
        factor
      );

      const previewContext = sheet(deviceWidth, deviceHeight);
      previewContext.drawImage(image, 0, 0, deviceWidth, deviceHeight);
      const preview = grayscale(
        previewContext.getImageData(0, 0, deviceWidth, deviceHeight).data,
        deviceWidth,
        deviceHeight,
        factor
      );

      let inkPixels = 0;
      let differingPixels = 0;
      let strictDifferingPixels = 0;
      for (let i = 0; i < preview.length; i++) {
        if (preview[i]! < 250) inkPixels++;
        const delta = Math.abs(pdf[i]! - preview[i]!);
        if (delta > 0) strictDifferingPixels++;
        if (delta > tolerance) differingPixels++;
      }

      // What one pixel of drift costs, measured on the preview against itself.
      let shiftFloorPixels = 0;
      for (let y = 1; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (Math.abs(preview[(y - 1) * width + x]! - preview[y * width + x]!) > tolerance) {
            shiftFloorPixels++;
          }
        }
      }

      // Let each band slide vertically and keep its best match. What survives is
      // the two layouts disagreeing; what it removes is one of them sitting low.
      let alignedPixels = 0;
      let driftPixels = 0;
      let driftSaturated = false;
      for (let top = 0; top < height; top += band) {
        const bottom = Math.min(height, top + band);
        let bandInk = 0;
        for (let y = top; y < bottom; y++) {
          for (let x = 0; x < width; x++) if (preview[y * width + x]! < 250) bandInk++;
        }
        let best = Number.POSITIVE_INFINITY;
        let bestDrift = 0;
        for (let drift = -maxDrift; drift <= maxDrift; drift++) {
          let count = 0;
          for (let y = top; y < bottom; y++) {
            const from = y + drift;
            if (from < 0 || from >= height) {
              count += width;
              continue;
            }
            for (let x = 0; x < width; x++) {
              if (Math.abs(pdf[from * width + x]! - preview[y * width + x]!) > tolerance) count++;
            }
          }
          if (count < best) {
            best = count;
            bestDrift = drift;
          }
        }
        alignedPixels += best;
        // A band with no ink matches at any offset, so its drift says nothing.
        if (bandInk > INK_BAND_MINIMUM) {
          driftPixels = Math.max(driftPixels, Math.abs(bestDrift));
          // The best match sat on the edge of the search, so the band may be
          // further out than this and the number is a floor.
          if (Math.abs(bestDrift) === maxDrift) driftSaturated = true;
        }
      }

      // The picture: the preview faded to gray, every differing pixel in red.
      const diffContext = sheet(width, height);
      const picture = diffContext.createImageData(width, height);
      for (let i = 0; i < preview.length; i++) {
        const faded = 255 - Math.round((255 - preview[i]!) * 0.25);
        const differs = Math.abs(pdf[i]! - preview[i]!) > tolerance;
        picture.data[i * 4] = differs ? 220 : faded;
        picture.data[i * 4 + 1] = differs ? 38 : faded;
        picture.data[i * 4 + 2] = differs ? 38 : faded;
        picture.data[i * 4 + 3] = 255;
      }
      diffContext.putImageData(picture, 0, 0);

      pages.push({
        number,
        totalPixels: width * height,
        inkPixels,
        differingPixels,
        strictDifferingPixels,
        shiftFloorPixels,
        alignedPixels,
        driftPixels,
        driftSaturated,
        image: diffContext.canvas.toDataURL("image/png"),
      });
    }
  } finally {
    await document_.destroy();
  }

  return { pdfPageCount, previewPageCount: previews.length, pages, missing };
}

/** The little of pdf.js the in-page pass uses. */
interface PdfjsLike {
  getDocument: (options: { data: Uint8Array; isEvalSupported: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getViewport: (options: { scale: number }) => { width: number; height: number };
        render: (options: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }) => { promise: Promise<void> };
      }>;
      destroy: () => Promise<void>;
    }>;
  };
}
