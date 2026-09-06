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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overflowProposalData, ProposalDocument } from "../src/examples";
import { PAPER_HEIGHT_PX, PAPER_WIDTH_PX } from "../src/components/paper";
import { proposalLogoImage } from "../src/examples/pdf";
import { renderPdf, type PdfImage } from "../src/pdf";
import { chromiumExecutable, closeChromium } from "../src/pdf/adapters/chromium";
import { readPdf } from "./pdf-reader";
import { PREVIEW_PLAN } from "./preview-plan";

/** CSS pixels at 96 dpi to the PDF's points at 72 dpi. */
const PX_TO_PT = 72 / 96;

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
    // This file owns the browser it started, and nothing else in the run does.
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
