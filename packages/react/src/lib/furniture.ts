/**
 * What a document carries on every page, and where it is drawn.
 *
 * A finished business document is not only its content: it has a running head,
 * a foot that says which page of how many this is, and sometimes a stamp across
 * the sheet until it is final. None of that is part of the flow. It repeats,
 * identically, on every page, which is the one thing a paginated tree cannot
 * express: a per-page element written into the tree is measured once, planned
 * onto one page, and drawn there alone.
 *
 * So furniture is declared beside the tree rather than in it, and each output
 * draws it with the mechanism it already has for repeating something on every
 * page: the preview draws the bands on each sheet it lays out, and the PDF
 * engine is handed them as its own per-page bands. One declaration, two
 * mechanisms, so a caller writes the header once and hands the same object to
 * `<Pages furniture={…}>` and to `renderPdf(element, { furniture })`.
 *
 * **Furniture is drawn inside the margin the document already declares.** The
 * band sits between the paper's edge and the content box, so the content
 * budget, the page plan and the page count are exactly what they are without
 * it: a document does not repaginate because someone added a footer. The price
 * is that a band has a height limit, and a band that does not fit fails by name
 * rather than printing over the first line of the page.
 *
 * **Furniture renders outside the document's artifact binding.** It is drawn
 * around the document, not inside it, on both sides — so a header cannot read a
 * field path. Pass what it prints in as props.
 */

import type { ReactNode } from "react";

/** What a document carries on every page. Each slot is composed content. */
export interface PageFurniture {
  /** Drawn in the top margin of every page. */
  header?: ReactNode;
  /** Drawn in the bottom margin of every page. */
  footer?: ReactNode;
  /**
   * Drawn across the whole of every page, behind the content: a watermark.
   * It takes no room in the margin, so it has no height limit.
   */
  stamp?: ReactNode;
}

/** A slot that is drawn in the margin, and so has a height to answer for. */
export type FurnitureBandSlot = "header" | "footer";

/** Every slot a document may declare. */
export type FurnitureSlot = FurnitureBandSlot | "stamp";

/** The slots, in the order an error lists them. */
export const FURNITURE_SLOTS: readonly FurnitureSlot[] = ["header", "footer", "stamp"];

/**
 * How far a band sits from the paper's edge, in the CSS pixels both outputs
 * measure paper in.
 *
 * It is a placement rule both outputs follow rather than a preference: the
 * preview draws its bands at this inset and the default engine draws its own at
 * the same one, so the two sheets agree. The engine exposes no inset to set, so
 * the value is calibrated by observation, and `tests/pdf-furniture.test.tsx`
 * solves the band's top edge back out of two rendered pages set at different
 * sizes and pins it to this number. An engine that moved its inset would fail
 * there rather than drift the two outputs apart in silence.
 */
export const FURNITURE_EDGE_INSET_PX = 20;

/** The attribute a page-number component marks its counter slots with. */
export const PAGE_COUNTER_ATTRIBUTE = "data-page-counter";

/** Which number a counter slot prints. */
export type PageCounter = "current" | "total";

/** How tall a band may be inside a margin of `marginPx`. */
export function furnitureBandBudgetPx(marginPx: number): number {
  return Math.max(0, marginPx - FURNITURE_EDGE_INSET_PX);
}

/** The slots a document declared, in slot order. */
export function declaredFurnitureSlots(
  furniture: PageFurniture | undefined
): readonly FurnitureSlot[] {
  if (furniture === undefined) return [];
  return FURNITURE_SLOTS.filter((slot) => furniture[slot] !== undefined);
}

/**
 * True when there is anything to draw.
 *
 * A predicate rather than a boolean, so a caller that has checked does not also
 * have to rule `undefined` out by hand.
 */
export function hasPageFurniture(
  furniture: PageFurniture | undefined
): furniture is PageFurniture {
  return declaredFurnitureSlots(furniture).length > 0;
}

/**
 * A document whose furniture the chosen engine does not draw.
 *
 * Declared beside each engine and refused here for the reason a writing
 * direction is: an engine with no per-page mechanism does not fail on a header,
 * it renders the document without one, and a contract whose running head is
 * missing on every page is worse than a render that stopped. An engine says
 * which slots it draws; a slot nobody claimed fails naming both.
 */
export class UnsupportedFurnitureError extends Error {
  /** The engine that was asked. */
  readonly adapter: string;
  /** The declared slots it does not draw. */
  readonly slots: readonly FurnitureSlot[];
  /** The slots it does draw. */
  readonly drawn: readonly FurnitureSlot[];

  constructor(adapter: string, slots: readonly FurnitureSlot[], drawn: readonly FurnitureSlot[]) {
    super(
      `The "${adapter}" adapter does not draw the page furniture this document declares: ` +
        `${slots.join(", ")}. It draws ${drawn.length === 0 ? "none of the slots" : drawn.join(" and ")}. ` +
        "Rendering it anyway would write a document whose every page is missing its furniture, " +
        "which is a document that looks finished and is not. Choose an adapter that draws the " +
        "slot, or remove it from the render."
    );
    this.name = "UnsupportedFurnitureError";
    this.adapter = adapter;
    this.slots = slots;
    this.drawn = drawn;
  }
}

/**
 * Fails unless the engine draws every slot the document declares.
 *
 * Takes the capability rather than the whole adapter, as the direction check
 * does, so it is the same function for a resolved engine and for the
 * declaration a new one makes. It restates the shape instead of naming
 * `PdfAdapter`, because the adapter seam imports this module: the two would be
 * a cycle. `PdfAdapter.furniture` is the field this reads, and a change to it
 * has to be made in both places.
 *
 * @throws {UnsupportedFurnitureError} naming the adapter and every slot it drops.
 */
export function assertFurnitureSupported(
  adapter: { name: string; furniture?: readonly FurnitureSlot[] },
  furniture: PageFurniture | undefined
): void {
  const drawn = adapter.furniture ?? [];
  const undrawn = declaredFurnitureSlots(furniture).filter((slot) => !drawn.includes(slot));
  if (undrawn.length > 0) throw new UnsupportedFurnitureError(adapter.name, undrawn, drawn);
}

/**
 * A band that does not fit in the margin it is drawn in.
 *
 * Drawing it anyway is the silent loss this package exists to rule out: the
 * engine does not reflow for a band, so an oversize header prints over the
 * first line of every page and the file still opens. The refusal names the
 * slot, the height the band needed, and the margin it had, because those three
 * are the whole decision — widen the margin or shorten the band.
 */
export class PageFurnitureOverflowError extends Error {
  /** The slot that did not fit. */
  readonly slot: FurnitureBandSlot;
  /** The height the band laid out to, in CSS pixels. */
  readonly heightPx: number;
  /** The height a band may take inside this margin. */
  readonly budgetPx: number;
  /** The document's margin, in CSS pixels. */
  readonly marginPx: number;

  constructor(slot: FurnitureBandSlot, heightPx: number, marginPx: number) {
    const budgetPx = furnitureBandBudgetPx(marginPx);
    super(
      `The page furniture's ${slot} is ${heightPx} px tall and does not fit in this document's ` +
        `${marginPx} px margin, which leaves ${budgetPx} px for a band once the ` +
        `${FURNITURE_EDGE_INSET_PX} px inset from the paper's edge is taken. Furniture is drawn ` +
        "inside the margin so the content budget and the page count do not change, so it cannot " +
        `be given room by reflowing the page: either shorten the ${slot} or raise the document's ` +
        "marginPx token."
    );
    this.name = "PageFurnitureOverflowError";
    this.slot = slot;
    this.heightPx = heightPx;
    this.budgetPx = budgetPx;
    this.marginPx = marginPx;
  }
}

/**
 * Checks one measured band against the margin it is drawn in.
 *
 * @throws {PageFurnitureOverflowError} naming the slot, the height and the margin.
 */
export function assertFurnitureBandFits(
  slot: FurnitureBandSlot,
  heightPx: number,
  marginPx: number
): void {
  if (heightPx > furnitureBandBudgetPx(marginPx)) {
    throw new PageFurnitureOverflowError(slot, heightPx, marginPx);
  }
}
