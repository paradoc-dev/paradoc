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

export interface ReadPage {
  /** 1-based page number. */
  number: number;
  /** Every text item on the page, joined. */
  text: string;
  /** True when the page paints an image. */
  hasImage: boolean;
  /** Page box in PDF points. */
  size: { width: number; height: number };
}

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
      pages.push({
        number,
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
