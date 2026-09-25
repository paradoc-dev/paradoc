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
   * It takes no room in the margin, so its only limit is the sheet itself.
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
 * It is a placement rule every output follows rather than a preference: the
 * preview draws its bands at this inset, the default engine draws its own at
 * the same one, and the Chromium adapter places its print templates there, so
 * the sheets agree. The default engine exposes no inset to set, so the value is
 * calibrated by observation, and `@paradoc/react-pdf`'s
 * `tests/pdf-furniture.test.tsx` and `tests/pdf-chromium-furniture.test.tsx`
 * each solve the band's top edge back out of two rendered pages set at
 * different sizes and pin it to this number.
 * An engine that moved its inset would fail there rather than drift the outputs
 * apart in silence.
 */
export const FURNITURE_EDGE_INSET_PX = 20;

/** The attribute a page-number component marks its counter slots with. */
export const PAGE_COUNTER_ATTRIBUTE = "data-page-counter";

/** DOM vocabulary shared by components, pagination, and PDF translation. */
export const RENDER_ATTRIBUTES = {
  section: "data-section", tableHeader: "data-table-header", tableRow: "data-table-row",
  breakBefore: "data-break-before", tableFooter: "data-table-footer",
  keepWithNext: "data-keep-with-next", pageHeader: "data-page-header",
  pageFooter: "data-page-footer", pageCounter: PAGE_COUNTER_ATTRIBUTE,
  keepId: "data-keep-id", keepRepeat: "data-keep-repeat",
  continuedLabel: "data-continued-label",
} as const;

/** Public class and rule for directionally isolated left-to-right values. */
export const LTR_ISOLATE_CLASS = "paradoc-ltr-isolate";
export const LTR_ISOLATE_STYLESHEET = `.${LTR_ISOLATE_CLASS} {\n  direction: ltr;\n  unicode-bidi: isolate;\n}`;

/**
 * The attribute the preview marks each drawn band with, by slot.
 *
 * The preview's fit check finds the bands it measures by these, so the markup
 * that draws a band and the check that measures it agree on one name.
 */
export const FURNITURE_BAND_ATTRIBUTES: Readonly<Record<FurnitureBandSlot, string>> = {
  header: RENDER_ATTRIBUTES.pageHeader,
  footer: RENDER_ATTRIBUTES.pageFooter,
};

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
 * A slot an engine draws, holding something that engine cannot draw there.
 *
 * The slot itself is supported, so this is not `UnsupportedFurnitureError`: it
 * is one kind of content in one slot. The Chromium adapter prints the stamp
 * inside the document, where it fills no page counter, so a page number in
 * the stamp would print the same number on every page. That is refused naming
 * the adapter, the slot and what it could not draw.
 */
export class UnsupportedFurnitureContentError extends Error {
  /** The engine that was asked. */
  readonly adapter: string;
  /** The slot holding what it cannot draw. */
  readonly slot: FurnitureSlot;
  /** What it cannot draw there, in words. */
  readonly content: string;

  constructor(adapter: string, slot: FurnitureSlot, content: string, remedy: string) {
    super(
      `The "${adapter}" adapter cannot draw ${content} in the page furniture's ${slot}. ` +
        `Rendering it anyway would print a page that looks right and is not. ${remedy}`
    );
    this.name = "UnsupportedFurnitureContentError";
    this.adapter = adapter;
    this.slot = slot;
    this.content = content;
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

/** What a slot laid out to, and the room it had. */
export interface FurnitureFit {
  /** The height the slot laid out to, in CSS pixels. */
  heightPx: number;
  /**
   * The height the slot may take: a band's share of the margin, or the height
   * of the sheet for the stamp.
   */
  budgetPx: number;
  /** The document's margin, in CSS pixels. */
  marginPx: number;
}

/**
 * Furniture that does not fit in the room it is drawn in.
 *
 * Drawing it anyway is the silent loss this package exists to rule out. The
 * engine does not reflow for a band, so an oversize header prints over the
 * first line of every page and the file still opens. A stamp is drawn across
 * the whole sheet, so one taller than the sheet is cut off at the paper's edge
 * on every page. The refusal names the slot, the height it needed, and the
 * room it had, because those are the whole decision.
 */
export class PageFurnitureOverflowError extends Error {
  /** The slot that did not fit. */
  readonly slot: FurnitureSlot;
  /** The height the slot laid out to, in CSS pixels. */
  readonly heightPx: number;
  /**
   * The height the slot may take: a band's share of the margin, or the height
   * of the sheet for the stamp.
   */
  readonly budgetPx: number;
  /** The document's margin, in CSS pixels. */
  readonly marginPx: number;

  constructor(slot: FurnitureSlot, { heightPx, budgetPx, marginPx }: FurnitureFit) {
    super(
      slot === "stamp"
        ? `The page furniture's stamp is ${heightPx} px tall and does not fit on this document's ` +
            `${budgetPx} px sheet. The stamp is drawn across the whole sheet, so the part that ` +
            "does not fit would be cut off at the paper's edge on every page: set the stamp " +
            "smaller or shorten its text."
        : `The page furniture's ${slot} is ${heightPx} px tall and does not fit in this document's ` +
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
 * A stamp with a word, or a line held together, wider than the sheet it is
 * drawn across.
 *
 * Neither wraps, so it lays out on one line wider than the paper and is cut
 * off at both edges on every page, however short the stamp is. The height
 * check cannot see it, so it is refused on its own, naming the sheet's width.
 */
export class PageStampTooWideError extends Error {
  /** The slot, which is always the stamp. */
  readonly slot = "stamp" as const;
  /** The sheet's width, in CSS pixels. */
  readonly sheetWidthPx: number;

  constructor(sheetWidthPx: number) {
    super(
      "The page furniture's stamp has a word or a line held together wider than " +
        `this document's ${sheetWidthPx} px sheet. ` +
        "Neither wraps, so it would be cut off at both edges of the paper on every page: " +
        "set the stamp smaller, break the word or let the line wrap."
    );
    this.name = "PageStampTooWideError";
    this.sheetWidthPx = sheetWidthPx;
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
  const budgetPx = furnitureBandBudgetPx(marginPx);
  if (heightPx > budgetPx) throw new PageFurnitureOverflowError(slot, { heightPx, budgetPx, marginPx });
}

/** The stamp, laid out at the sheet's width twice. */
export interface StampMeasure {
  /** The height it lays out to, in CSS pixels. */
  heightPx: number;
  /**
   * The height it lays out to when every line may wrap and any word may
   * break. Taller than `heightPx` only when a line held together, or a word,
   * did not fit the sheet's width.
   */
  brokenHeightPx: number;
}

/**
 * Checks the measured stamp against the sheet it is drawn across.
 *
 * The stamp is measured as it lays out at the sheet's width, before any
 * rotation, which is the box both engines and the preview centre on the
 * sheet. Text that wraps grows taller, and a word or a line held together
 * that is wider than the sheet is found by letting it wrap and break and
 * seeing the stamp grow. A rotation can still carry a box
 * that fits past the sheet's corners; that is not measured.
 *
 * @throws {PageFurnitureOverflowError} naming the stamp, its height and the sheet's.
 * @throws {PageStampTooWideError} when a word or a line held together is wider
 * than the sheet.
 */
export function assertFurnitureStampFits(
  measured: StampMeasure,
  geometry: { widthPx: number; heightPx: number; marginPx: number }
): void {
  const heightPx = Math.ceil(measured.heightPx);
  if (heightPx > geometry.heightPx) {
    throw new PageFurnitureOverflowError("stamp", {
      heightPx,
      budgetPx: geometry.heightPx,
      marginPx: geometry.marginPx,
    });
  }
  if (Math.ceil(measured.brokenHeightPx) > heightPx) throw new PageStampTooWideError(geometry.widthPx);
}
