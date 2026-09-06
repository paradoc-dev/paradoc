/**
 * Reading the document's keeps out of a laid-out DOM.
 *
 * This is the only place the preview touches layout. It turns the measuring
 * container into the intervals `planPages` fills pages with, and knows nothing
 * about pages; the plan knows nothing about the DOM.
 */

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

    return {
      id: node.getAttribute("data-keep-id") ?? "",
      top: rect.top - origin,
      bottom: rect.bottom - origin,
      sections: sectionChain(node, root),
      table: header ?? row ?? undefined,
      tableHeader: header !== null,
    };
  });
}
