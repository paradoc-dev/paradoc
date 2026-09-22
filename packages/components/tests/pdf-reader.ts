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

/** One painted image, at the box the page's current transform gave it. */
export interface ReadImage {
  /** Painted width in PDF points. */
  width: number;
  /** Painted height in PDF points. */
  height: number;
}

export interface ReadPage {
  /** 1-based page number. */
  number: number;
  /** Every text item on the page, joined. */
  text: string;
  /** True when the page paints an image. */
  hasImage: boolean;
  /** How many image-painting operations the page carries. */
  imageCount: number;
  /** The box each painted image was given, in the order they are painted. */
  images: ReadImage[];
  /** Page box in PDF points. */
  size: { width: number; height: number };
}

const IMAGE_OPS = new Set([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
]);

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `a` applied after `b`, in the order PDF concatenates a transform. */
function concat(a: Matrix, b: Matrix): Matrix {
  return [
    b[0] * a[0] + b[1] * a[2],
    b[0] * a[1] + b[1] * a[3],
    b[2] * a[0] + b[3] * a[2],
    b[2] * a[1] + b[3] * a[3],
    b[4] * a[0] + b[5] * a[2] + a[4],
    b[4] * a[1] + b[5] * a[3] + a[5],
  ];
}

/**
 * The box each painted image landed in, by replaying the page's transforms.
 *
 * A PDF paints an image into the unit square, so the current transform is the
 * box. Replaying `save`/`restore`/`transform` is the only way to read the size
 * a reader actually sees, which is what an image at a declared size promises.
 */
function paintedImages(operators: { fnArray: number[]; argsArray: unknown[] }): ReadImage[] {
  const painted: ReadImage[] = [];
  const stack: Matrix[] = [];
  let current: Matrix = IDENTITY;

  operators.fnArray.forEach((fn, index) => {
    if (fn === pdfjs.OPS.save) stack.push(current);
    else if (fn === pdfjs.OPS.restore) current = stack.pop() ?? IDENTITY;
    else if (fn === pdfjs.OPS.transform) {
      current = concat(current, operators.argsArray[index] as Matrix);
    } else if (IMAGE_OPS.has(fn)) {
      painted.push({
        width: Math.round(Math.hypot(current[0], current[1])),
        height: Math.round(Math.hypot(current[2], current[3])),
      });
    }
  });

  return painted;
}

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
      const images = paintedImages(operators);
      pages.push({
        number,
        text: content.items.map((item) => ("str" in item ? item.str : "")).join(""),
        hasImage: images.length > 0,
        imageCount: images.length,
        images,
        size: { width: viewport.width, height: viewport.height },
      });
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
