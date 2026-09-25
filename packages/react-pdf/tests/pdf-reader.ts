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
import type { Node } from "@takumi-rs/helpers";

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

export interface ReadImage {
  width: number;
  height: number;
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
  imageCount: number;
  images: ReadImage[];
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

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function concat(a: Matrix, b: Matrix): Matrix {
  return [
    b[0] * a[0] + b[1] * a[2], b[0] * a[1] + b[1] * a[3],
    b[2] * a[0] + b[3] * a[2], b[2] * a[1] + b[3] * a[3],
    b[4] * a[0] + b[5] * a[2] + a[4], b[4] * a[1] + b[5] * a[3] + a[5],
  ];
}

function paintedImages(operators: { fnArray: number[]; argsArray: unknown[] }): ReadImage[] {
  const painted: ReadImage[] = [];
  const stack: Matrix[] = [];
  let current: Matrix = IDENTITY;
  operators.fnArray.forEach((fn, index) => {
    if (fn === pdfjs.OPS.save) stack.push(current);
    else if (fn === pdfjs.OPS.restore) current = stack.pop() ?? IDENTITY;
    else if (fn === pdfjs.OPS.transform) current = concat(current, operators.argsArray[index] as Matrix);
    else if (IMAGE_OPS.has(fn)) painted.push({
      width: Math.round(Math.hypot(current[0], current[1])),
      height: Math.round(Math.hypot(current[2], current[3])),
    });
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

export interface TreeKeep {
  id: string;
  text: string;
  table?: string;
  tableHeader: boolean;
  tableFooter: boolean;
  keepWithNext: boolean;
}

export function flattenNodes(node: Node): Node[] {
  const found = [node];
  if (node.type === "container" && node.children) {
    for (const child of node.children) found.push(...flattenNodes(child));
  }
  return found;
}

export function nodeByKeepId(node: Node, id: string): Node | undefined {
  return flattenNodes(node).find((each) => each.attributes?.["data-keep-id"] === id);
}

export function textOf(node: Node): string {
  if (node.type === "text") return node.text;
  if (node.type === "container" && node.children) return node.children.map(textOf).join("");
  return "";
}

export function treeKeeps(node: Node, into: TreeKeep[] = []): TreeKeep[] {
  const attributes = node.attributes ?? {};
  const id = attributes["data-keep-id"];
  if (id !== undefined) {
    const header = attributes["data-table-header"];
    const row = attributes["data-table-row"];
    const footer = attributes["data-table-footer"];
    into.push({
      id,
      text: textOf(node),
      table: header ?? row ?? footer,
      tableHeader: header !== undefined,
      tableFooter: footer !== undefined,
      keepWithNext: attributes["data-keep-with-next"] !== undefined,
    });
  }
  if (node.type === "container" && node.children) {
    for (const child of node.children) treeKeeps(child, into);
  }
  return into;
}

export function normalizeText(text: string): string {
  return text.replaceAll(/\s+/gu, "").toUpperCase();
}

export function digitTokens(text: string): string[] {
  return (text.match(/\d[\d.,]*\d|\d/gu) ?? []).filter((token) => token.length > 0);
}

export function opensWithTokens(page: readonly string[], tokens: readonly string[]): boolean {
  if (tokens.length === 0 || tokens.length > page.length) return false;
  const head = [...page.slice(0, tokens.length)].sort();
  const wanted = [...tokens].sort();
  return head.every((token, index) => token === wanted[index]);
}
