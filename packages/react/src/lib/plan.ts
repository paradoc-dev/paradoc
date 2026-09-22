/**
 * The page plan: which keeps land on which page.
 *
 * This is the whole of pagination, and it is a pure function of where the
 * keeps sit in one measured flow. Nothing here touches the DOM, so the fill
 * rule, the header repeat and the oversize case are testable without a browser,
 * and the preview and the PDF's page-break hints read the same plan.
 *
 * A keep is an interval, not a height. Heights would be wrong: the masthead
 * puts two columns of keeps beside each other and so does the acceptance
 * section, and adding those heights would count the same band of the page
 * twice. Measuring where each keep starts and ends in the flow counts a shared
 * band once and needs no separate notion of the gaps between keeps, because
 * the gaps are already in the offsets.
 *
 * The rules, in the order they apply:
 *
 * 1. Keeps fill a page greedily in document order and are never split. A keep
 *    whose bottom would fall past the budget starts the next page, which then
 *    begins at that keep's top.
 * 2. A page that closes on a table header carries that header forward instead
 *    of keeping it, because rows only ever follow a header, so a page never
 *    ends on a header with nothing under it.
 * 3. A page that opens on a table row repeats that table's header above it. The
 *    copy is not in the flow, so it takes its own height plus the gap to the
 *    first row out of the page's budget, and it is listed in `repeats`.
 * 4. A page opened for a table footer carries that table's last row forward
 *    with it, so the totals never read on a page without the rows they
 *    total. A row alone on its page stays where it is, because carrying it
 *    would only empty that page.
 * 5. A keep that still does not fit the page opened for it overflows that page
 *    and is reported in `oversize` with what it actually consumed, which for a
 *    page carrying a header copy includes that copy.
 * 6. A section is present on a page when any of its keeps are.
 */

/** One pagination unit, as an interval in the flow measured at page content width. */
export interface MeasuredKeep {
  /** The keep's `data-keep-id`. */
  id: string;
  /** Offset of the keep's top edge in the measured flow, in CSS pixels. */
  top: number;
  /** Offset of the keep's bottom edge in the measured flow, in CSS pixels. */
  bottom: number;
  /** Sections enclosing this keep, outermost first. */
  sections?: readonly string[];
  /** The table this keep belongs to, when it is a header, a row, or a footer. */
  table?: string;
  /** True when this keep is its table's repeatable header. */
  tableHeader?: boolean;
  /**
   * Set by an explicit `PageBreak`: this keep must open a fresh page even
   * though it would otherwise fit on the current one. The keep still carries
   * no height of its own — the flow ordering, not a forced height, is what
   * moves everything after it.
   */
  breakBefore?: "page";
  /** True when this keep is its table's footer, which never opens a page without the last row. */
  tableFooter?: boolean;
}

/** A keep that does not fit the page opened for it. */
export interface OversizeKeep {
  id: string;
  /** What the keep consumed on its page, including a header copy above it. */
  height: number;
}

/** The plan the preview renders and the PDF render is hinted with. */
export interface PagePlan {
  /** Browser-measured font faces and their byte identity. */
  fonts?: import("./application-fonts").ApplicationFontSnapshot;
  /** KeepTogether ids on each page, in order, including repeated table headers. */
  pages: string[][];
  /**
   * KeepTogether ids on each page that are copies rather than the keep's one place in
   * the flow. Only a repeated table header is ever a copy. The parity suite reads the
   * first keep of a page past these. `renderPdf` takes them beside `breaks`
   * and copies the same header above the keep that opens the page.
   */
  repeats: string[][];
  /** Section ids present on each page, outermost first. */
  sections: string[][];
  /**
   * The keep that starts each page from page 2 onward. A copy is never a
   * break: the tree holds one of it, so the break is the first keep that
   * actually flows onto the page.
   */
  breaks: string[];
  /** Keeps that overflow the page opened for them, in document order. */
  oversize: OversizeKeep[];
  /** The page content height the plan was filled against, in CSS pixels. */
  budget: number;
}

/** One page under construction. */
interface PageBuild {
  keeps: string[];
  repeats: string[];
  start: string;
}

export class InvalidPagePlanInputError extends Error {
  constructor(message: string) {
    super(`Cannot plan pages: ${message}`);
    this.name = "InvalidPagePlanInputError";
  }
}

function validateInputs(keeps: readonly MeasuredKeep[], budget: number): void {
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new InvalidPagePlanInputError(`budget must be a positive finite number; received ${budget}.`);
  }
  const ids = new Set<string>();
  for (const keep of keeps) {
    if (keep.id.length === 0) throw new InvalidPagePlanInputError("keep ids cannot be empty.");
    if (ids.has(keep.id)) throw new InvalidPagePlanInputError(`keep id "${keep.id}" is duplicated.`);
    if (!Number.isFinite(keep.top) || !Number.isFinite(keep.bottom) || keep.top < 0 || keep.bottom < keep.top) {
      throw new InvalidPagePlanInputError(`keep "${keep.id}" has invalid coordinates ${keep.top}..${keep.bottom}.`);
    }
    ids.add(keep.id);
  }
}

/** Groups a page's keeps into the sections that enclose them, without repeats. */
function sectionsOf(page: readonly string[], byId: Map<string, MeasuredKeep>): string[] {
  const present: string[] = [];
  for (const id of page) {
    for (const section of byId.get(id)?.sections ?? []) {
      if (!present.includes(section)) present.push(section);
    }
  }
  return present;
}

/** Fills pages greedily with keeps that never split, against a fixed budget. */
export function planPages(keeps: readonly MeasuredKeep[], budget: number): PagePlan {
  validateInputs(keeps, budget);
  const byId = new Map(keeps.map((keep) => [keep.id, keep]));

  const headers = new Map<string, MeasuredKeep>();
  for (const keep of keeps) {
    if (keep.tableHeader && keep.table) headers.set(keep.table, keep);
  }

  /**
   * What a copied header costs a page: its own height plus the gap the flow
   * puts between it and the first row, which the copy reproduces.
   */
  const charges = new Map<string, number>();
  for (const [table, header] of headers) {
    // An explicit break named for this table (see `PageBreak`'s `table` prop)
    // is not a row: it must never stand in for the real first row here, or a
    // break placed directly after a header would charge the gap to the break
    // instead of to the row the copy actually sits above. A footer is not a
    // row either.
    const firstRow = keeps.find(
      (keep) =>
        keep.table === table && !keep.tableHeader && !keep.tableFooter && keep.breakBefore === undefined
    );
    const gap = firstRow ? Math.max(0, firstRow.top - header.bottom) : 0;
    charges.set(table, header.bottom - header.top + gap);
  }

  const pages: PageBuild[] = [];
  const oversize: OversizeKeep[] = [];
  let current: PageBuild | null = null;
  /** Flow offset that the current page's content box begins at. */
  let origin = 0;

  /**
   * Takes a table header left alone at the foot of the page just filled, so it
   * can open the next page instead. A copy is never carried: it is not the
   * header's place in the flow.
   */
  const carryOrphanHeader = (): MeasuredKeep | undefined => {
    const page = pages[pages.length - 1];
    const last = page?.keeps[page.keeps.length - 1];
    if (!page || last === undefined || page.repeats.includes(last)) return undefined;

    const header = byId.get(last);
    if (!header?.tableHeader) return undefined;

    page.keeps.pop();
    if (page.keeps.length === 0) pages.pop();
    return header;
  };

  /**
   * Takes the row a table footer follows off the foot of the page just filled,
   * so the footer can open the next page beside it. The row is carried only
   * when it is the last keep of that page, belongs to the footer's table, and
   * is not the only keep there.
   */
  const carryLastRow = (footer: MeasuredKeep): MeasuredKeep | undefined => {
    const page = pages[pages.length - 1];
    const last = page?.keeps[page.keeps.length - 1];
    if (!page || last === undefined || page.repeats.includes(last)) return undefined;

    const row = byId.get(last);
    if (!row || row.table !== footer.table || row.tableHeader || row.tableFooter) return undefined;
    if (page.keeps.length - page.repeats.length <= 1) return undefined;

    page.keeps.pop();
    return row;
  };

  /** Opens a page for `keep`, carrying or repeating a table header above it. */
  const openPage = (keep: MeasuredKeep): PageBuild => {
    const row = keep.tableFooter ? carryLastRow(keep) : undefined;
    if (row) {
      // The row opens the page as any continued row does: behind the header
      // itself when carrying it left the header orphaned, else a copy of it.
      const page = openPage(row);
      page.keeps.push(row.id);
      return page;
    }

    const carried = carryOrphanHeader();
    if (carried) {
      // The header keeps its place in the flow, one page later.
      const page: PageBuild = { keeps: [carried.id], repeats: [], start: carried.id };
      pages.push(page);
      origin = carried.top;
      return page;
    }

    const copy =
      keep.tableHeader || !keep.table || pages.length === 0
        ? undefined
        : headers.get(keep.table);
    if (copy && keep.table) {
      const page: PageBuild = { keeps: [copy.id], repeats: [copy.id], start: keep.id };
      pages.push(page);
      // The copy sits above the row without being in the flow, so it shifts
      // everything below it down by what it costs.
      origin = keep.top - (charges.get(keep.table) ?? 0);
      return page;
    }

    const page: PageBuild = { keeps: [], repeats: [], start: keep.id };
    pages.push(page);
    origin = keep.top;
    return page;
  };

  for (const keep of keeps) {
    // An explicit break forces the same fresh-page path an overflowing keep
    // takes: `openPage` decides what carries or repeats onto it exactly as it
    // would for a natural break, so a break landing on an orphaned table
    // header or inside a table's rows is handled the one way, not two.
    if (current === null || keep.bottom - origin > budget || keep.breakBefore === "page") {
      current = openPage(keep);
    }
    current.keeps.push(keep.id);

    const used = keep.bottom - origin;
    if (used > budget) {
      // The page was opened for this keep and it still does not fit.
      oversize.push({ id: keep.id, height: used });
      current = null;
    }
  }

  return {
    pages: pages.map((page) => page.keeps),
    repeats: pages.map((page) => page.repeats),
    sections: pages.map((page) => sectionsOf(page.keeps, byId)),
    breaks: pages.slice(1).map((page) => page.start),
    oversize,
    budget,
  };
}
