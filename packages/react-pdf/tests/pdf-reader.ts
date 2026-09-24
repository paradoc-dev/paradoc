/**
 * Reads a rendered PDF back with pdfjs-dist, the way a reader would.
 *
 * The render tests assert what a person opening the file sees — how many pages,
 * what text is selectable on each, whether an image is painted — rather than
 * anything about the bytes the engine happened to write.
 */

import { createRequire } from "node:module";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = `file://${join(require.resolve("pdfjs-dist/package.json"), "../legacy/build/pdf.worker.mjs")}`;

/** One run of text, where the page draws it. */
export interface ReadItem {
  /** The run itself. */
  text: string;
  /** Distance from the page's left edge, in CSS pixels. */
  leftPx: number;
  /** Distance from the page's top edge to the run's baseline, in CSS pixels. */
  topPx: number;
  /** The run's advance along its baseline, in CSS pixels. */
  widthPx: number;
  /**
   * The angle the run's baseline rises at, in degrees anticlockwise as a reader
   * sees the page: 0 for level text, 45 for a watermark rising to the right.
   */
  angleDeg: number;
}

export interface ReadPage {
  /** 1-based page number. */
  number: number;
  /** Every text item on the page, joined. */
  text: string;
  /** Every text item on the page, in draw order, with where it sits. */
  items: ReadItem[];
  /** True when the page paints an image. */
  hasImage: boolean;
  /** Page box in PDF points. */
  size: { width: number; height: number };
}

/** The PDF's points at 72 dpi to the CSS pixels the page is laid out in. */
const PT_PER_PX = 72 / 96;

const IMAGE_OPS = new Set([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
]);

/** Every page of `bytes`, in order. */
export async function readPdf(bytes: Uint8Array): Promise<ReadPage[]> {
  const document = await pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  try {
    const pages: ReadPage[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const operators = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1 });
      const items = content.items.flatMap((item) =>
        "str" in item
          ? [{
              text: item.str,
              leftPx: item.transform[4] / PT_PER_PX,
              topPx: (viewport.height - item.transform[5]) / PT_PER_PX,
              widthPx: item.width / PT_PER_PX,
              angleDeg: (Math.atan2(item.transform[1], item.transform[0]) * 180) / Math.PI,
            }]
          : []
      );
      pages.push({
        number,
        items,
        text: content.items.map((item) => ("str" in item ? item.str : "")).join(""),
        hasImage: operators.fnArray.some((fn) => IMAGE_OPS.has(fn)),
        size: { width: viewport.width, height: viewport.height },
      });
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
