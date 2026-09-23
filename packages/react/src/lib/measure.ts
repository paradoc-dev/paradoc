/**
 * Reading the document's keeps out of a laid-out DOM.
 *
 * This is the only place the preview touches layout. It turns the measuring
 * container into the intervals `planPages` fills pages with, and knows nothing
 * about pages; the plan knows nothing about the DOM.
 */

import { FURNITURE_BAND_ATTRIBUTES, type FurnitureBandSlot } from "./furniture";
import type { MeasuredKeep } from "./plan";

/** The sections enclosing `node`, outermost first, within `root`. */
function sectionChain(node: HTMLElement, root: HTMLElement): string[] {
  const chain: string[] = [];
  for (let current = node.parentElement; current && current !== root; current = current.parentElement) {
    const section = current.getAttribute("data-section");
    if (section !== null) chain.unshift(section);
  }
  return chain;
}

/**
 * Measures every keep in the flow, in document order.
 *
 * Each keep is reported as the interval it occupies relative to the top of the
 * measuring container, so the gaps the layout puts between keeps are already
 * accounted for and two keeps laid out side by side occupy the same band
 * rather than two.
 */
export function measureKeeps(root: HTMLElement): MeasuredKeep[] {
  const origin = root.getBoundingClientRect().top;

  return [...root.querySelectorAll<HTMLElement>("[data-keep-id]")].map((node) => {
    const rect = node.getBoundingClientRect();
    const header = node.getAttribute("data-table-header");
    const row = node.getAttribute("data-table-row");
    const breakBefore = node.getAttribute("data-break-before");
    const footer = node.getAttribute("data-table-footer");
    const keepWithNext = node.getAttribute("data-keep-with-next");

    return {
      id: node.getAttribute("data-keep-id") ?? "",
      top: rect.top - origin,
      bottom: rect.bottom - origin,
      sections: sectionChain(node, root),
      table: header ?? row ?? footer ?? undefined,
      tableHeader: header !== null,
      keepWithNext: keepWithNext !== null,
      breakBefore: breakBefore === "page" ? "page" : undefined,
      tableFooter: footer !== null,
    };
  });
}

/** One band of page furniture as it laid out. */
export interface MeasuredFurnitureBand {
  /** The slot the band is drawn in. */
  slot: FurnitureBandSlot;
  /** The height it laid out to, in CSS pixels. */
  heightPx: number;
}

/**
 * Measures the header and footer bands laid out under `root`, in slot order.
 *
 * A band is found by the attribute its slot is marked with, and a slot with no
 * band is left out. `root` must not be scaled: the height is read from the
 * layout box, which a transform would shrink.
 */
export function measureFurnitureBands(root: HTMLElement): MeasuredFurnitureBand[] {
  const bands: MeasuredFurnitureBand[] = [];
  for (const slot of ["header", "footer"] as const) {
    const node = root.querySelector<HTMLElement>(`[${FURNITURE_BAND_ATTRIBUTES[slot]}]`);
    if (node !== null) bands.push({ slot, heightPx: node.getBoundingClientRect().height });
  }
  return bands;
}
