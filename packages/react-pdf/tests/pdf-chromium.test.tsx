/**
 * The Chromium adapter, read back as a reader sees it.
 *
 * Every assertion goes through pdfjs-dist rather than through the bytes: the
 * criterion is a PDF a person can open, with the pages the plan asked for and
 * selectable text on them.
 *
 * What this file does not measure is parity. Whether a Chromium page is the
 * preview's page pixel for pixel is a browser measurement against a running
 * lab, which is `tests/parity/` and is deliberately not part of `pnpm test`.
 * What is checked here is the adapter's contract: the same plan, applied the
 * same way, reported the same way, and takumi still answering a call that names
 * no adapter.
 *
 * It needs a Chrome, and it does not decide for itself whether to run. A
 * machine with no browser fails these tests loudly, because a suite that skips
 * on its own subject covers nothing and says so quietly. Set
 * `PARADOC_SKIP_CHROMIUM_TESTS=1` to opt out deliberately.
 */

import { fromJsx } from "@takumi-rs/helpers/jsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Document } from "../../components/src/components/document";
import { Field } from "../../components/src/components/field";
import {
  overflowProposalData,
  proposalForm,
  ProposalDocument,
  shortProposalData,
} from "../../components/src/examples";
import { Table } from "../../components/src/components/table";
import { PAPER_HEIGHT_PX, PAPER_WIDTH_PX, planPages, type MeasuredKeep } from "@paradoc/react";
import { proposalLogoImage } from "../../components/src/examples/pdf";
import { renderPdf, type PdfImage } from "../src";
import { chromiumExecutable, closeChromium } from "../src/adapters/chromium";
import { readPdf } from "./pdf-reader";
import { treeKeeps } from "./tree-keeps";
import { PREVIEW_PLAN } from "./preview-plan";

/** CSS pixels at 96 dpi to the PDF's points at 72 dpi. */
const PX_TO_PT = 72 / 96;

/** Three paragraphs of one value, each recognisable in a PDF's text layer. */
const PARAGRAPHED_TERMS = [
  "Payment is due thirty days from the date of the invoice.",
  "Work begins once both parties have signed this proposal.",
  "Either party may end the engagement on fourteen days notice.",
];

/** The text the table header carries, which is how a copy is recognised in a PDF. */
const HEADER_TEXT = "DESCRIPTION";

/**
 * Opting out is explicit, and it is the only way out.
 *
 * Gating on Chrome's absence would turn a machine with no browser into a green
 * run that measured nothing, which is exactly the silent loss the rest of this
 * package refuses. So a missing browser fails, and a run that genuinely has no
 * business driving one says so in the environment.
 */
const skipped = process.env.PARADOC_SKIP_CHROMIUM_TESTS === "1";
if (skipped) {
  console.log("Skipping the Chromium adapter tests: PARADOC_SKIP_CHROMIUM_TESTS=1.");
}

let logo: PdfImage;

describe.skipIf(skipped)("the Chromium adapter", () => {
  beforeAll(async () => {
    const executable = await chromiumExecutable();
    if (executable === undefined) {
      throw new Error(
        "The Chromium adapter tests need a Chrome. None of the well-known install paths " +
          "exists: set PUPPETEER_EXECUTABLE_PATH to one, or set " +
          "PARADOC_SKIP_CHROMIUM_TESTS=1 to opt out of this file deliberately."
      );
    }
    logo = await proposalLogoImage();
  });

  afterAll(async () => {
    // This file owns the browser it started for its own suite. `isolate: true`
    // in vitest.config.ts gives every test file a fresh module registry, so
    // `pdf-class-support-chromium.test.tsx`'s own `shared` browser and its own
    // `closeChromium` call are independent of this one.
    await closeChromium();
  });

  it("renders the overflow proposal on the page the preview fixes", async () => {
    const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter: "chromium",
      images: [logo],
      plan: PREVIEW_PLAN,
    });
    const pages = await readPdf(bytes);

    expect(pages).toHaveLength(4);
    for (const page of pages) {
      expect(page.size.width).toBeCloseTo(PAPER_WIDTH_PX * PX_TO_PT, 0);
      expect(page.size.height).toBeCloseTo(PAPER_HEIGHT_PX * PX_TO_PT, 0);
    }
  }, 120_000);

  it("carries selectable text, not a picture of the document", async () => {
    const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter: "chromium",
      images: [logo],
      plan: PREVIEW_PLAN,
    });
    const [first] = await readPdf(bytes);

    expect(first!.text).toContain("Services Proposal");
    expect(first!.text).toContain("Northgate Systems");
    expect(first!.text).toContain("Harbor Freight Collective");
  }, 120_000);

  it("opens each page on the row the plan breaks on, under a copied header", async () => {
    const { bytes, unknownBreaks, unknownRepeats } = await renderPdf(
      <ProposalDocument data={overflowProposalData} />,
      { adapter: "chromium", images: [logo], plan: PREVIEW_PLAN }
    );
    const pages = await readPdf(bytes);

    expect(unknownBreaks).toEqual([]);
    expect(unknownRepeats).toEqual([]);

    // A continued page opens with the header copy and then the row the plan
    // named, in that order. Reading the text is how the criterion is stated
    // everywhere else in this package: the PDF publishes no keep map.
    const rows = overflowProposalData.fields.lineItems as { description: string }[];
    const continued: [number, number][] = [
      [2, 13],
      [3, 39],
      [4, 65],
    ];
    for (const [number, row] of continued) {
      const text = pages[number - 1]!.text;
      expect(text.startsWith(HEADER_TEXT)).toBe(true);
      expect(text.slice(HEADER_TEXT.length)).toContain(rows[row]!.description);
    }

    // Page 1 opens the document, so it carries the header in its own place in
    // the flow rather than as a copy: exactly one header per page either way.
    for (const page of pages) {
      expect(page.text.split(HEADER_TEXT)).toHaveLength(2);
    }
  }, 120_000);

  it("breaks a paragraphed field between the paragraphs the plan broke it between", async () => {
    // The other adapter's side of the same claim, checked on the default
    // engine in `@paradoc/components`' `field-prose` suite: `paragraphs` makes
    // each paragraph a keep, so a break named between two of them is a break
    // this adapter can honour. Without the prop there is one keep and the
    // break would be a hint the tree cannot carry.
    const data = {
      ...shortProposalData,
      fields: { ...shortProposalData.fields, terms: PARAGRAPHED_TERMS.join("\n\n") },
    };
    const { bytes, unknownBreaks } = await renderPdf(
      <Document artifact={proposalForm} data={data} id="field-prose">
        <Field path="terms" paragraphs />
      </Document>,
      { adapter: "chromium", plan: { breaks: ["field:terms:2"], repeats: [[], []] } }
    );
    const pages = await readPdf(bytes);

    expect(unknownBreaks).toEqual([]);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.text).toContain(PARAGRAPHED_TERMS[0]);
    expect(pages[0]!.text).toContain(PARAGRAPHED_TERMS[1]);
    expect(pages[0]!.text).not.toContain(PARAGRAPHED_TERMS[2]);
    expect(pages[1]!.text).toContain(PARAGRAPHED_TERMS[2]);
    expect(pages[1]!.text).not.toContain(PARAGRAPHED_TERMS[0]);
  }, 120_000);

  it("carries Table's continued-page label, the same substitution takumi's node-tree walk makes", async () => {
    // The Chromium adapter clones its header copies straight from the DOM
    // rather than walking a resolved node tree, so the substitution
    // `tree.ts`'s `revealContinuedLabel` makes has its own translation here —
    // this is the proof the two agree on which header shows the label.
    const element = (
      <Document artifact={proposalForm} data={overflowProposalData} id="continued-chromium">
        <Table
          path="lineItems"
          id="line-items"
          continuedLabel="(continued)"
          columns={[{ field: "description", width: "basis-1/2" }, { field: "amount", width: "basis-1/2", align: "right" }]}
        />
      </Document>
    );
    const { node } = await fromJsx(element);
    let y = 0;
    const keeps: MeasuredKeep[] = treeKeeps(node).map(({ id, table, tableHeader, tableFooter, keepWithNext }) => {
      const laid = { id, table, tableHeader, tableFooter, keepWithNext, top: y, bottom: y + 60 };
      y = laid.bottom;
      return laid;
    });
    const plan = planPages(keeps, 300);
    const repeatedPageIndexes = plan.repeats
      .map((copies, index) => (copies.length > 0 ? index : -1))
      .filter((index) => index >= 0);
    expect(repeatedPageIndexes.length).toBeGreaterThanOrEqual(1);

    const { bytes, unknownBreaks, unknownRepeats } = await renderPdf(element, { adapter: "chromium", plan });
    expect(unknownBreaks).toEqual([]);
    expect(unknownRepeats).toEqual([]);
    const pages = await readPdf(bytes);

    expect(pages[0]?.text).not.toContain("(continued)");
    for (const index of repeatedPageIndexes) {
      expect(pages[index]?.text, `page ${index + 1}`).toContain("(continued)");
    }
  }, 120_000);

  it("paginates on its own when it is given no plan", async () => {
    const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter: "chromium",
      images: [logo],
    });
    const pages = await readPdf(bytes);

    // Blink decides where the pages end and owes the preview's plan nothing, so
    // what is asserted is that it paginated at all and repeated no header: a
    // copy is the plan's doing and there is no plan here.
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1]!.text.startsWith(HEADER_TEXT)).toBe(false);
  }, 120_000);

  it("names a hint the tree cannot honour and renders anyway", async () => {
    const { bytes, unknownBreaks, unknownRepeats } = await renderPdf(
      <ProposalDocument data={overflowProposalData} />,
      {
        adapter: "chromium",
        images: [logo],
        plan: {
          breaks: ["line-items:13", "line-items:9999"],
          repeats: [[], ["line-items:header"], ["line-items:missing-header"]],
        },
      }
    );
    const pages = await readPdf(bytes);

    expect(unknownBreaks).toEqual(["line-items:9999"]);
    expect(unknownRepeats).toEqual(["line-items:missing-header"]);
    expect(pages.length).toBeGreaterThan(1);
  }, 120_000);

  it("prints the same bytes for the same document across a second boundary", async () => {
    const element = <ProposalDocument data={shortProposalData} />;
    const first = await renderPdf(element, { adapter: "chromium", images: [logo] });
    // Skia stamps the print time to the second, so the second render starts
    // in a later second than the first one finished in.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const second = await renderPdf(element, { adapter: "chromium", images: [logo] });

    const text = Buffer.from(second.bytes).toString("latin1");
    expect(text).not.toMatch(/\/(?:CreationDate|ModDate)/u);
    expect(Buffer.from(second.bytes).equals(Buffer.from(first.bytes))).toBe(true);
    // Blanking moved no byte, so the file still opens as the document it was.
    expect((await readPdf(second.bytes))[0]!.text).toContain("Services Proposal");
  }, 120_000);
});

describe("renderPdf without an adapter", () => {
  it("still renders through takumi, which needs no browser", async () => {
    const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      images: [await proposalLogoImage()],
    });
    const pages = await readPdf(bytes);

    // The default is not "whichever engine is available": takumi is the engine
    // the parity numbers were measured on, and a call that names nothing has
    // to keep reaching it.
    expect(pages).toHaveLength(4);
  }, 60_000);
});
