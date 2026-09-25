/**
 * How page furniture reaches a takumi page.
 *
 * The engine repeats a band at the top and the bottom of every page itself, and
 * fills the text of any node whose class list names one of its counters. That
 * is the whole of what is engine-specific about furniture, so it lives here
 * rather than in a component: a page-number component marks its slots with
 * `data-page-counter` and this module translates those marks into the class
 * hooks this engine reads. A component that named `pageNumber` itself would be
 * a component that names an engine.
 *
 * Three things happen to a slot on the way to a band:
 *
 * 1. It is resolved and translated exactly as the document tree is, by
 *    `preparePdfTree`, so a class the engine cannot express fails the render
 *    rather than being dropped in a band nobody reads closely.
 * 2. It is wrapped in a band that carries the document's own margin as
 *    horizontal padding. The engine lays a band out at the full width of the
 *    paper, so without this the running head would start at the paper's edge
 *    rather than above the first column of the content it heads.
 * 3. It is measured, and a band taller than the margin is refused by name. The
 *    engine does not reflow the page for a band: an oversize one simply prints
 *    over the first line of every page.
 *
 * The stamp is not a band. It is an absolutely positioned layer the width and
 * height of the whole sheet, carried inside the header band because that is the
 * one thing the engine already repeats on every page, and pulled back up by the
 * band's own inset so it is centred on the paper rather than on the band. It
 * takes no room in the margin, so it has no height to answer for, and the
 * engine paints the band before the content, which is what puts a watermark
 * behind the text rather than over it. The band that carries it is stretched to
 * the height of the paper, because a band clips what overflows it.
 *
 * The stamp is measured too, as it lays out at the sheet's width, and a stamp
 * taller than the sheet, or with a word or a line held together wider than it,
 * is refused by name: it would be cut off at the paper's edge on every page.
 */

import type { Node } from "@takumi-rs/helpers";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import type { ReactNode } from "react";

import {
  assertFurnitureBandFits,
  assertFurnitureStampFits,
  FURNITURE_EDGE_INSET_PX,
  PAGE_COUNTER_ATTRIBUTE,
  type FurnitureBandSlot,
  type PageFurniture,
} from "@paradoc/react";
import type { PdfPageGeometry } from "../adapter";
import { preparePdfTree, recordOnce } from "../tree";
import { isPageCounter, PAGE_COUNTER_CLASSES } from "./counters";

/** The class this engine fills with each counter a component marked. */

/** The bands, and everything translating them turned up. */
export interface TranslatedFurniture {
  /** The top band, without the stamp layer. */
  header?: BandNode;
  /** The bottom band. */
  footer?: BandNode;
  /** The stamp's content, which is drawn on a whole-sheet layer once it is measured. */
  stamp?: Node;
  /** Classes outside the verified vocabulary, unique and in document order. */
  unsupportedClasses: string[];
  /** Image `src` values the caller supplied no bytes for. */
  missingImages: string[];
  /**
   * Stylesheets the slots' own markup carried, in the order they were found.
   *
   * A band is resolved by the same function the document tree is, and that
   * function hands back whatever `<style>` the markup declared. Dropping them
   * would be a band that renders without the rules it was written against and
   * says nothing, so they join the render's stylesheets with the tree's.
   */
  stylesheets: string[];
}

/** Nothing declared, nothing to draw. */
const NO_FURNITURE: TranslatedFurniture = {
  unsupportedClasses: [],
  missingImages: [],
  stylesheets: [],
};

/** What a slot needs to be resolved and checked the way the document tree is. */
export interface TranslateFurnitureOptions {
  /** The page both outputs are measured against. */
  geometry: PdfPageGeometry;
  /** `src` values the caller supplied bytes for. */
  imageSources: Iterable<string>;
}

/**
 * Replaces this engine's counter hooks onto the slots a component marked.
 *
 * The class is written as `className` rather than `tw`: `tw` is the engine's
 * styling property and only the class list it reads carries the counters. The
 * walk has already moved every styling class to `tw`, so nothing is overwritten
 * here.
 */
function withCounterHooks(node: Node): Node {
  const counter = node.attributes?.[PAGE_COUNTER_ATTRIBUTE];
  const hooked: Node = isPageCounter(counter)
    ? { ...node, className: PAGE_COUNTER_CLASSES[counter] }
    : node;
  if (hooked.type !== "container" || hooked.children === undefined) return hooked;
  return { ...hooked, children: hooked.children.map(withCounterHooks) };
}

/** A node that holds children, which every band is. */
type BandNode = Extract<Node, { type: "container" }>;

/** One band: the slot's content, indented to the document's own margin. */
function band(content: Node, geometry: PdfPageGeometry): BandNode {
  return {
    type: "container",
    tagName: "div",
    style: {
      position: "relative",
      paddingLeft: geometry.marginPx,
      paddingRight: geometry.marginPx,
    },
    children: [content],
  };
}

/**
 * The stamp's content, centred both ways on a row the width of the sheet.
 *
 * Measured as it is, this answers the height the stamp lays out to, which is
 * what has to fit on the sheet. The layer the engine draws is this row, sized
 * and placed; the two share one definition so they cannot lay out apart.
 */
function stampRow(content: Node, geometry: PdfPageGeometry): BandNode {
  return {
    type: "container",
    tagName: "div",
    style: {
      width: geometry.widthPx,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    children: [content],
  };
}

/**
 * The same tree with every line free to wrap and every word free to break.
 *
 * Set on each node rather than inherited from the row, because a stamp that
 * holds its line together sets that on its own text, and a class there would
 * win over anything the row passes down. Only a line or a word wider than the
 * row breaks, so the copy grows taller than the stamp only when one is.
 */
function breakAnywhere(node: Node): Node {
  const broken = { ...node, style: { ...node.style, textWrapMode: "wrap", overflowWrap: "anywhere" } } as Node;
  if (broken.type !== "container" || broken.children === undefined) return broken;
  return { ...broken, children: broken.children.map(breakAnywhere) };
}

/**
 * The whole-sheet layer a stamp is drawn on.
 *
 * `top` pulls the layer back up by the inset the band itself sits at, so the
 * layer covers the paper rather than the paper minus that inset, and the stamp
 * inside it is centred on the page.
 */
function stampLayer(content: Node, geometry: PdfPageGeometry): BandNode {
  const row = stampRow(content, geometry);
  return {
    ...row,
    style: {
      ...row.style,
      position: "absolute",
      top: -FURNITURE_EDGE_INSET_PX,
      left: 0,
      height: geometry.heightPx,
    },
  };
}

/** Resolves and checks one slot, collecting what the walk found. */
async function translateSlot(
  content: ReactNode,
  into: TranslatedFurniture,
  options: TranslateFurnitureOptions
): Promise<Node> {
  const { node, stylesheets } = await fromJsx(content);
  for (const sheet of stylesheets) recordOnce(into.stylesheets, sheet);
  const prepared = preparePdfTree(node, {
    imageSources: options.imageSources,
  });
  for (const name of prepared.unsupportedClasses) recordOnce(into.unsupportedClasses, name);
  for (const src of prepared.missingImages) recordOnce(into.missingImages, src);
  return withCounterHooks(prepared.node);
}

/**
 * Every declared slot, translated for this engine.
 *
 * Nothing is measured here. The classes the whole render refuses are collected
 * in one pass with the document tree's, so a band and a body that both name an
 * unsupported class are one error rather than two renders.
 */
export async function translateFurniture(
  furniture: PageFurniture | undefined,
  options: TranslateFurnitureOptions
): Promise<TranslatedFurniture> {
  if (furniture === undefined) return NO_FURNITURE;
  const translated: TranslatedFurniture = {
    unsupportedClasses: [],
    missingImages: [],
    stylesheets: [],
  };
  if (furniture.header !== undefined) {
    translated.header = band(await translateSlot(furniture.header, translated, options), options.geometry);
  }
  if (furniture.footer !== undefined) {
    translated.footer = band(await translateSlot(furniture.footer, translated, options), options.geometry);
  }
  if (furniture.stamp !== undefined) {
    translated.stamp = await translateSlot(furniture.stamp, translated, options);
  }
  return translated;
}

/** Lays a band out at the page width and answers its height in CSS pixels. */
export type MeasureBand = (node: Node) => Promise<number>;

/** The bands this render hands the engine. */
export interface FurnitureBands {
  /** Repeated at the top of every page, and the stamp's layer when there is one. */
  header?: BandNode;
  /** Repeated at the bottom of every page. */
  footer?: BandNode;
}

/**
 * The measured bands, or the refusal.
 *
 * The stamp joins the header band only after both have been measured, so a
 * whole-sheet layer never counts against the margin a running head has to fit
 * in, and a document with a stamp and no header gets a band whose only child
 * takes no room.
 *
 * @throws {PageFurnitureOverflowError} naming the slot, its height and the room it had.
 */
export async function measureFurnitureBands(
  translated: TranslatedFurniture,
  geometry: PdfPageGeometry,
  measure: MeasureBand
): Promise<FurnitureBands> {
  const bands: FurnitureBands = {};
  const slots: readonly [FurnitureBandSlot, BandNode | undefined][] = [
    ["header", translated.header],
    ["footer", translated.footer],
  ];
  for (const [slot, node] of slots) {
    if (node === undefined) continue;
    assertFurnitureBandFits(slot, Math.ceil(await measure(node)), geometry.marginPx);
    bands[slot] = node;
  }
  if (translated.stamp !== undefined) {
    const row = stampRow(translated.stamp, geometry);
    assertFurnitureStampFits(
      { heightPx: await measure(row), brokenHeightPx: await measure(breakAnywhere(row)) },
      geometry
    );
    bands.header = {
      type: "container",
      tagName: "div",
      style: {
        position: "relative",
        // A column, so the layer is taken out of the flow. Without it, the
        // engine lays the layer out in line with a sibling that is a bare span
        // or an empty box: the stamp lands in the page's top corner and its
        // rotation is dropped. `tests/pdf-stamp.test.tsx` holds it centred.
        display: "flex",
        flexDirection: "column",
        // The band clips what overflows it, and a band is a line or two tall, so
        // a whole-sheet layer inside one is drawn and then cut away to nothing.
        // The band that carries the stamp is therefore given the height of the
        // paper. The running head keeps its own band inside it, measured above
        // against the margin, and the engine's content box is fixed by the page
        // margin rather than by a band, so nothing moves.
        height: geometry.heightPx,
      },
      children: [
        stampLayer(translated.stamp, geometry),
        ...(bands.header === undefined ? [] : [bands.header]),
      ],
    };
  }
  return bands;
}
