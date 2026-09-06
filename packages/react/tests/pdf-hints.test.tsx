/**
 * Hint mode: the preview decides the page breaks and the engine obeys them.
 *
 * Every assertion reads the finished PDF with pdfjs-dist. The criterion the
 * specification states is what a reader sees — a page that starts where the
 * preview's page started, with the same repeated table header above a continued
 * row — so nothing here inspects the bytes or the engine's own opinion.
 *
 * A plan is a browser measurement, and this file has no browser. Two sources
 * are used, and they answer different questions:
 *
 * - A plan computed from the real keep list at stub heights, which proves the
 *   mechanism: the engine breaks at every hint and only at a hint, for a page
 *   count that no natural overflow could have produced.
 * - The plan the lab measures for the overflow set, recorded in the README,
 *   which is the acceptance criterion: the same page count as the preview, and
 *   the preview's breaks.
 */

import { fromJsx } from "@takumi-rs/helpers/jsx";
import { beforeAll, describe, expect, it } from "vitest";
import { ProposalDocument, overflowProposalData } from "../src/examples";
import { planPages, type MeasuredKeep, type PagePlan } from "../src/lib/plan";
import { preparePdfTree, renderPdf, type PageBreakPlan } from "../src/pdf";
import { proposalLogoImage } from "../src/examples/pdf";
import { readPdf, type ReadPage } from "./pdf-reader";
import { PREVIEW_PLAN } from "./preview-plan";
import { normalizeText as normalize, treeKeeps } from "./tree-keeps";

const rows = overflowProposalData.fields.lineItems as { description: string }[];

let logo: Awaited<ReturnType<typeof proposalLogoImage>>;

beforeAll(async () => {
  logo = await proposalLogoImage();
});

/**
 * The document's real keeps, laid out one under another at a stub height, and
 * the text each of them carries.
 *
 * The keeps come from the tree the engine itself resolves, so the ids, the
 * table membership and the order are the ones the render will see. Only the
 * geometry is invented: a plan is a browser measurement and this file has no
 * browser, so the heights are stubs and `plan.test.ts` is where the arithmetic
 * is checked.
 */
async function stubDocument(
  height: number,
  budget: number
): Promise<{ plan: PagePlan; textOf: (keepId: string) => string }> {
  const { node } = await fromJsx(<ProposalDocument data={overflowProposalData} />);
  const found = treeKeeps(node);

  let y = 0;
  const keeps: MeasuredKeep[] = found.map(({ id, table, tableHeader }) => {
    const laid = { id, table, tableHeader, top: y, bottom: y + height };
    y = laid.bottom;
    return laid;
  });
  const text = new Map(found.map(({ id, text: content }) => [id, normalize(content)]));

  return { plan: planPages(keeps, budget), textOf: (keepId) => text.get(keepId) ?? "" };
}

/** Renders the overflow proposal to PDF and reads it back. */
async function render(
  plan?: PageBreakPlan
): Promise<{ pages: ReadPage[]; unknownBreaks: string[]; unknownRepeats: string[] }> {
  const result = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
    images: [logo],
    plan,
  });
  return {
    pages: await readPdf(result.bytes),
    unknownBreaks: result.unknownBreaks,
    unknownRepeats: result.unknownRepeats,
  };
}

/** The text of the row a `line-items:<n>` keep id names. */
function rowText(keepId: string): string {
  return normalize(rows[Number(keepId.slice("line-items:".length))]!.description);
}

/** The table header, as both outputs carry it. */
const HEADER_TEXT = normalize("Description Qty Unit Unit price Amount");

describe("the engine breaks where the plan says, and only there", () => {
  let plan: PagePlan;
  let textOf: (keepId: string) => string;
  let hinted: ReadPage[];

  beforeAll(async () => {
    // Half a page of content per hinted page: nothing here can overflow into a
    // page the plan did not ask for, so the page count is the plan's alone.
    ({ plan, textOf } = await stubDocument(100, 900));
    const rendered = await render(plan);
    expect(rendered.unknownBreaks).toEqual([]);
    expect(rendered.unknownRepeats).toEqual([]);
    hinted = rendered.pages;
  }, 120_000);

  it("gives the PDF the page count the plan has", () => {
    expect(plan.pages.length).toBeGreaterThan(6);
    expect(hinted.length).toBe(plan.pages.length);
  });

  it("starts each page at the keep the plan broke on", () => {
    plan.breaks.forEach((keepId, index) => {
      const page = hinted[index + 1]!;
      // A continued page opens with the copied header, so the keep's text
      // follows it rather than leading the page.
      const opening = normalize(page.text).replace(HEADER_TEXT, "");
      expect(opening.startsWith(textOf(keepId)), `page ${index + 2} does not open on ${keepId}`).toBe(
        true
      );
    });
  });

  it("repeats the table header on every page the plan copies it onto", () => {
    // Without a floor the loop passes on a plan that copies nothing, which is
    // the one plan that would prove nothing at all.
    const copied = plan.repeats.filter((copies) => copies.length > 0);
    expect(copied.length).toBeGreaterThanOrEqual(plan.pages.length - 2);

    plan.repeats.forEach((copies, index) => {
      const page = hinted[index]!;
      if (copies.length === 0) return;
      expect(copies).toEqual(["line-items:header"]);
      expect(normalize(page.text).startsWith(HEADER_TEXT)).toBe(true);
    });
  });
});

describe("the render obeys the plan the lab measured for the overflow set", () => {
  let hinted: ReadPage[];

  beforeAll(async () => {
    const rendered = await render(PREVIEW_PLAN);
    expect(rendered.unknownBreaks).toEqual([]);
    expect(rendered.unknownRepeats).toEqual([]);
    hinted = rendered.pages;
  }, 120_000);

  it("gives the PDF the page count that plan has", () => {
    expect(hinted.length).toBe(PREVIEW_PLAN.pages);
  });

  it("opens each continued page with the header copy and then the preview's break", () => {
    PREVIEW_PLAN.breaks.forEach((keepId, index) => {
      const text = normalize(hinted[index + 1]!.text);
      expect(text.startsWith(HEADER_TEXT)).toBe(true);
      expect(text.replace(HEADER_TEXT, "").startsWith(rowText(keepId))).toBe(true);
    });
  });
});

describe("engine mode is left alone", () => {
  it("writes the table header once, because the tree holds one of it", async () => {
    const { pages } = await render();
    const carrying = pages.filter((page) => normalize(page.text).includes(HEADER_TEXT));
    // The engine paginates a tree with one header and no per-page header
    // option, so a continued page has none. Hint mode is where the copy comes
    // from; see the README's limitations.
    expect(carrying).toHaveLength(1);
    expect(carrying[0]!.number).toBe(1);
  }, 120_000);
});

describe("a hint the tree cannot honour is reported, not swallowed", () => {
  it("keeps the live breaks and names the stale one", async () => {
    const rendered = await render({
      breaks: [...PREVIEW_PLAN.breaks, "line-items:900"],
      repeats: PREVIEW_PLAN.repeats,
    });

    expect(rendered.unknownBreaks).toEqual(["line-items:900"]);
    // The stale hint is ignored rather than fatal, and the hints beside it are
    // still honoured: the page starts are the preview's.
    expect(rendered.pages).toHaveLength(PREVIEW_PLAN.pages);
    PREVIEW_PLAN.breaks.forEach((keepId, index) => {
      const text = normalize(rendered.pages[index + 1]!.text).replace(HEADER_TEXT, "");
      expect(text.startsWith(rowText(keepId))).toBe(true);
    });
  }, 120_000);

  it("names a repeat the tree does not have and opens the page without it", () => {
    const prepared = preparePdfTree(
      { type: "container", attributes: { "data-keep-id": "row" }, children: [] },
      { plan: { breaks: ["row"], repeats: [[], ["gone"]] } }
    );

    expect(prepared.unknownRepeats).toEqual(["gone"]);
    expect(prepared.appliedBreaks).toEqual(["row"]);
  });
});

describe("the copy is a copy, and the break sits on it", () => {
  const tree = {
    type: "container" as const,
    children: [
      { type: "container" as const, attributes: { "data-keep-id": "items:header" }, children: [] },
      { type: "container" as const, attributes: { "data-keep-id": "items:0" }, children: [] },
      { type: "container" as const, attributes: { "data-keep-id": "items:1" }, children: [] },
    ],
  };

  const prepared = preparePdfTree(tree, {
    plan: { breaks: ["items:1"], repeats: [[], ["items:header"]] },
  });
  const children = prepared.node.type === "container" ? (prepared.node.children ?? []) : [];

  it("inserts the copy immediately before the keep that starts the page", () => {
    expect(children.map((child) => child.attributes?.["data-keep-id"])).toEqual([
      "items:header",
      "items:0",
      "items:header",
      "items:1",
    ]);
  });

  it("marks the copy, and only the copy", () => {
    expect(children.map((child) => child.attributes?.["data-keep-repeat"])).toEqual([
      undefined,
      undefined,
      "true",
      undefined,
    ]);
  });

  it("puts the page break on the copy, so the header is not stranded", () => {
    // A break on the row instead would close the previous page after the
    // header copy, which is the one thing a repeated header must never do.
    expect(children[2]!.style?.breakBefore).toBe("page");
    expect(children[3]!.style?.breakBefore).toBeUndefined();
    expect(children[3]!.style?.breakInside).toBe("avoid");
  });

  it("leaves the header's own place in the flow alone", () => {
    expect(children[0]!.style?.breakBefore).toBeUndefined();
    expect(children[0]!.attributes?.["data-keep-repeat"]).toBeUndefined();
  });
});

describe("a copy never inherits the break its source carries", () => {
  /**
   * A header can be a planned break in its own right: `planPages` carries a
   * header left alone at the foot of a page forward to open the next one. That
   * same header is still copied above a later continued row, and the copy must
   * be given the break the plan means for it rather than the one its source
   * happens to carry.
   */
  const keep = (id: string) => ({
    type: "container" as const,
    attributes: { "data-keep-id": id },
    children: [],
  });

  const prepared = preparePdfTree(
    { type: "container", children: [keep("a:header"), keep("b:header"), keep("a:0"), keep("a:1")] },
    {
      plan: {
        breaks: ["a:header", "b:header", "a:1"],
        repeats: [[], [], [], ["a:header", "b:header"]],
      },
    }
  );
  const children = prepared.node.type === "container" ? (prepared.node.children ?? []) : [];

  it("puts both copies above the keep that opens the page", () => {
    expect(children.map((child) => child.attributes?.["data-keep-id"])).toEqual([
      "a:header",
      "b:header",
      "a:0",
      "a:header",
      "b:header",
      "a:1",
    ]);
    expect(children.map((child) => child.attributes?.["data-keep-repeat"])).toEqual([
      undefined,
      undefined,
      undefined,
      "true",
      "true",
      undefined,
    ]);
  });

  it("breaks on the first copy only, however the source was styled", () => {
    // Both sources carry `break-before: page` in their own place in the flow.
    expect(children[0]!.style?.breakBefore).toBe("page");
    expect(children[1]!.style?.breakBefore).toBe("page");
    // The first copy opens the page. The second sits under it and must not
    // break, or the page would end between the two halves of its own header.
    expect(children[3]!.style?.breakBefore).toBe("page");
    expect(children[4]!.style?.breakBefore).toBeUndefined();
    expect(children[4]!.style?.breakInside).toBe("avoid");
    expect(children[5]!.style?.breakBefore).toBeUndefined();
  });

  it("counts each planned break once, and never counts a copy", () => {
    expect(prepared.appliedBreaks).toEqual(["a:header", "b:header", "a:1"]);
  });
});

describe("a copy the plan names for a page no break opens is still reported", () => {
  it("names it, because the report is of the plan and not of what was applied", () => {
    const prepared = preparePdfTree(
      { type: "container", attributes: { "data-keep-id": "row" }, children: [] },
      // One break, so only page 2 can be opened by a hint. The copy listed for
      // page 3 pairs with no break, and naming a keep the tree lacks it is
      // still a divergence the caller has to hear about.
      { plan: { breaks: ["row"], repeats: [[], [], ["gone"]] } }
    );

    expect(prepared.unknownRepeats).toEqual(["gone"]);
    expect(prepared.unknownBreaks).toEqual([]);
  });
});
