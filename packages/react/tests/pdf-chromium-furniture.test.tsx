/**
 * Page furniture on the Chromium adapter, read back as a reader sees it.
 *
 * The same criterion `pdf-furniture.test.tsx` holds the default engine to:
 * every page of the file carries the running head, the foot with its own
 * number, and the stamp, and the document paginates exactly as it does without
 * any of them. The mechanism differs, which is why this file exists. The bands
 * ride Chromium's print templates, which are documents of their own with no
 * stylesheet of the page's, and the stamp is a fixed layer inside the printed
 * document. Each of those has its own way to go wrong in silence: a band set
 * in the template's own tiny root size, a band drawn at the paper's edge, a
 * stamp painted behind the page's white ground. Each is read back here.
 *
 * It needs a Chrome, like `pdf-chromium.test.tsx`, and opts out the same way.
 */

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PageNumber } from "../../components/src/components/page-number";
import {
  overflowProposalData,
  PROPOSAL_LOGO_SRC,
  ProposalDocument,
} from "../../components/src/examples";
import { proposalLogoImage } from "../../components/src/examples/pdf";
import { FURNITURE_EDGE_INSET_PX, type PageFurniture } from "../src/lib/furniture";
import { DEFAULT_PAGE_MARGIN_PX, PAGE_SIZES } from "../src/lib/tokens";
import {
  PageFurnitureOverflowError,
  renderPdf,
  UnsupportedFurnitureContentError,
  UnsupportedPdfContentError,
  type PdfImage,
} from "../src/pdf";
import { chromiumExecutable, closeChromium } from "../src/pdf/adapters/chromium";
import { readPdf, type ReadItem, type ReadPage } from "./pdf-reader";

const HEADER = "Northwind Partners LLP";
const STAMP = "DRAFT";

/** The three slots a finished document carries. */
const furniture: PageFurniture = {
  header: <span>{HEADER}</span>,
  footer: <PageNumber />,
  stamp: <span className="text-6xl text-neutral-300">{STAMP}</span>,
};

const skipped = process.env.PARADOC_SKIP_CHROMIUM_TESTS === "1";

let logo: PdfImage;
let furnished: ReadPage[];
let bare: ReadPage[];

/**
 * The item a run of text starts at.
 *
 * Chromium writes a line as several items, split wherever its shaper split
 * the run, so a run is found by where the page's text starting at an item
 * begins with it rather than by an item that holds it whole.
 */
function runStart(page: ReadPage, text: string): ReadItem | undefined {
  return page.items.find((_item, index) => {
    let joined = "";
    for (let at = index; at < page.items.length && joined.length < text.length; at++) {
      joined += page.items[at]!.text;
    }
    return joined.startsWith(text);
  });
}

/**
 * How many white fills the first page paints after the first glyph of `text`.
 *
 * A layer below the content is painted before it. If the page's own white
 * ground is painted after the layer instead, the layer is in the file and
 * invisible on paper, and reading the text back cannot tell. The paint order
 * can.
 */
async function whiteFillsAfter(bytes: Uint8Array, text: string): Promise<number> {
  const document = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    const { fnArray, argsArray } = await (await document.getPage(1)).getOperatorList();
    let seen = false;
    let white = false;
    let fills = 0;
    fnArray.forEach((fn, index) => {
      const args = argsArray[index] as unknown[];
      if (fn === pdfjs.OPS.setFillRGBColor) white = args[0] === "#ffffff";
      if (fn === pdfjs.OPS.showText) {
        const glyphs = args[0] as { unicode?: string }[];
        if (glyphs.some((glyph) => glyph.unicode === text[0])) seen = true;
      }
      if (seen && white && fn === pdfjs.OPS.constructPath) fills += 1;
    });
    return fills;
  } finally {
    await document.destroy();
  }
}

/** One render on this adapter, read back. */
async function chromiumPages(
  element: React.ReactElement,
  options: Omit<Parameters<typeof renderPdf>[1], "adapter"> = {}
): Promise<ReadPage[]> {
  return readPdf((await renderPdf(element, { ...options, adapter: "chromium" })).bytes);
}

describe.skipIf(skipped)("page furniture on the Chromium adapter", () => {
  beforeAll(async () => {
    if ((await chromiumExecutable()) === undefined) {
      throw new Error(
        "The Chromium furniture tests need a Chrome: set PUPPETEER_EXECUTABLE_PATH, or set " +
          "PARADOC_SKIP_CHROMIUM_TESTS=1 to opt out of this file deliberately."
      );
    }
    logo = await proposalLogoImage();
    const document = <ProposalDocument data={overflowProposalData} />;
    furnished = await chromiumPages(document, { images: [logo], furniture });
    bare = await chromiumPages(document, { images: [logo] });
  }, 120_000);

  afterAll(async () => {
    await closeChromium();
  });

  it("carries the header, the numbered footer and the stamp on every page", () => {
    expect(furnished.length).toBeGreaterThan(1);
    for (const page of furnished) {
      expect(page.text).toContain(HEADER);
      expect(page.text).toContain(STAMP);
      expect(page.text).toContain(`Page ${page.number} of ${furnished.length}`);
    }
  });

  it("leaves the page count and every page's content exactly as they were", () => {
    expect(furnished).toHaveLength(bare.length);
    for (const [index, page] of furnished.entries()) {
      // The stamp is painted first, because it is below the content; the
      // templates are drawn over the page once its content is.
      const foot = `Page ${page.number} of ${furnished.length}`;
      expect(page.text).toBe(`${STAMP}${bare[index]!.text}${HEADER}${foot}`);
    }
  });

  it("draws the bands inside the margin, clear of the content box", () => {
    const { heightPx } = PAGE_SIZES.letter;
    for (const page of furnished) {
      const header = runStart(page, HEADER);
      const footer = runStart(page, "Page");
      const bareFirst = bare[page.number - 1]!.items[0]!;
      const firstLine = page.items.find((item) => item.text === bareFirst.text);
      expect(header?.topPx).toBeGreaterThanOrEqual(FURNITURE_EDGE_INSET_PX);
      expect(header?.topPx).toBeLessThanOrEqual(DEFAULT_PAGE_MARGIN_PX);
      expect(footer?.topPx).toBeGreaterThanOrEqual(heightPx - DEFAULT_PAGE_MARGIN_PX);
      expect(footer?.topPx).toBeLessThanOrEqual(heightPx - FURNITURE_EDGE_INSET_PX);
      expect(firstLine?.topPx).toBe(bareFirst.topPx);
      expect(firstLine?.leftPx).toBe(bareFirst.leftPx);
    }
  });

  /**
   * The template's top edge, solved out of two renders the way the default
   * engine's is: the same band at two sizes with the leading pinned to the
   * size, so the baseline is the top edge plus a distance proportional to the
   * size, and `2 * small - large` is the top edge.
   */
  it("puts the band's top edge exactly at the inset the other outputs draw at", async () => {
    const baselineAt = async (fontSize: number) => {
      const [page] = await chromiumPages(<div>Anchor</div>, {
        tokens: { marginPx: 96 },
        // A block rather than a run: a browser's line box keeps the parent's
        // strut, so a run's own leading would not pin the line to its size.
        furniture: { header: <div style={{ fontSize, lineHeight: 1 }}>{HEADER}</div> },
      });
      return runStart(page!, HEADER)!.topPx;
    };

    const small = await baselineAt(12);
    const large = await baselineAt(24);
    // Blink sets each baseline on a whole pixel, so the two readings each carry
    // up to half a pixel of rounding and the solved edge up to a pixel. That is
    // a twentieth of the inset under test: an edge drawn at the paper, or at the
    // margin, is far outside it.
    const edge = Math.round(2 * small - large);
    expect(edge).toBeGreaterThanOrEqual(FURNITURE_EDGE_INSET_PX - 1);
    expect(edge).toBeLessThanOrEqual(FURNITURE_EDGE_INSET_PX + 1);
  }, 60_000);

  it("indents the band to the document's own margin, not to the paper's edge", () => {
    const header = runStart(furnished[0]!, HEADER);
    expect(header?.leftPx).toBeCloseTo(DEFAULT_PAGE_MARGIN_PX, 0);
  });

  // A template fills any element classed date, title or url with text of its
  // own, and pageNumber or totalPages with a counter, whether the band marked a
  // counter there or not. A band that uses those names for its own reasons
  // prints its own text, and only the slot it marked is filled.
  it("prints a band's own text in an element classed as a template field", async () => {
    const [page] = await chromiumPages(<div>Anchor</div>, {
      furniture: {
        header: (
          <div>
            <span className="title font-bold">Agreement</span>{" "}
            <span className="date">Signed copy</span> <span className="url">Filed online</span>{" "}
            <span className="pageNumber">Schedule</span> <span className="totalPages">Annex</span>
          </div>
        ),
        footer: <PageNumber />,
      },
    });

    for (const own of ["Agreement", "Signed copy", "Filed online", "Schedule", "Annex"]) {
      expect(page!.text).toContain(own);
    }
    expect(page!.text).toContain("Page 1 of 1");
  }, 60_000);

  // A template's root font size is Chromium's, not the document's, and it is a
  // fraction of it. A right-aligned run starts where its own width puts it, so a
  // band sized in `rem` that printed small would start further right than the
  // same run sized in pixels. Without the root carried across, this fails.
  it("sets a band sized in rem at the size the document's root gives it", async () => {
    const startOf = async (run: React.ReactElement) => {
      const [page] = await chromiumPages(<div>Anchor</div>, {
        furniture: { footer: <div className="flex justify-end">{run}</div> },
      });
      return runStart(page!, "Folio")!.leftPx;
    };

    const inRem = await startOf(<span className="text-xs">Folio twelve</span>);
    const inPixels = await startOf(<span style={{ fontSize: 12, lineHeight: "16px" }}>Folio twelve</span>);
    expect(inRem).toBeCloseTo(inPixels, 0);
  }, 60_000);

  it("paints the stamp before the content, so it sits behind it", () => {
    for (const page of furnished) {
      expect(page.items[0]?.text).toBe(STAMP.slice(0, page.items[0]!.text.length));
      expect(page.items[0]?.text.length).toBeGreaterThan(0);
    }
  });

  // The printed page's body is white. A layer below the content that is not in
  // a stacking context of its own is painted below the body's ground too, and
  // comes out of the file as text nobody can see.
  it("paints the stamp above the page's white ground", async () => {
    const { bytes } = await renderPdf(<div>Anchor</div>, {
      adapter: "chromium",
      furniture: { stamp: furniture.stamp },
    });
    expect(await whiteFillsAfter(bytes, STAMP)).toBe(0);
  }, 60_000);

  // The layer is fixed against the page's content box and pulled back out by
  // the margin to cover the sheet. The window is narrower than the margin, so a
  // layer left on the content box, or dropped to the first page's flow, fails.
  it("centres the stamp on the paper on every page", () => {
    const { heightPx, widthPx } = PAGE_SIZES.letter;
    for (const page of furnished) {
      const stamp = page.items.filter((item) => STAMP.includes(item.text) && item.text.length > 0);
      expect(stamp.length).toBeGreaterThan(0);
      // The run's baseline sits below the centre by about a third of a 60 px
      // line, so the window is centred there rather than on the paper's middle.
      expect(Math.abs(stamp[0]!.topPx - heightPx / 2)).toBeLessThan(DEFAULT_PAGE_MARGIN_PX);
      expect(stamp[0]!.leftPx).toBeGreaterThan(widthPx / 4);
      expect(stamp[0]!.leftPx).toBeLessThan(widthPx / 2);
    }
  });

  describe("furniture that cannot be drawn", () => {
    const document = <ProposalDocument data={overflowProposalData} />;

    it("refuses a footer taller than the margin, naming the slot and the heights", async () => {
      const failure = await renderPdf(document, {
        adapter: "chromium",
        images: [logo],
        furniture: { footer: <div style={{ height: 80 }}>Too much foot</div> },
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(PageFurnitureOverflowError);
      const error = failure as PageFurnitureOverflowError;
      expect(error.slot).toBe("footer");
      expect(error.heightPx).toBe(80);
      expect(error.marginPx).toBe(DEFAULT_PAGE_MARGIN_PX);
    }, 60_000);

    it("accepts a band that exactly fills the margin's budget", async () => {
      const exact = (
        <div style={{ height: DEFAULT_PAGE_MARGIN_PX - FURNITURE_EDGE_INSET_PX }}>Snug</div>
      );
      const pages = await chromiumPages(document, { images: [logo], furniture: { header: exact } });
      expect(pages[0]!.text).toContain("Snug");
    }, 60_000);

    it("refuses an image in a band the render supplied no bytes for, naming it", async () => {
      const failure = await renderPdf(document, {
        adapter: "chromium",
        images: [],
        furniture: { header: <img src={PROPOSAL_LOGO_SRC} alt="" width={40} height={12} /> },
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UnsupportedPdfContentError);
      expect((failure as UnsupportedPdfContentError).images).toContain(PROPOSAL_LOGO_SRC);
    }, 60_000);

    it("draws an image in a band from the bytes the render supplied", async () => {
      const pages = await chromiumPages(<div>Anchor</div>, {
        images: [logo],
        furniture: { header: <img src={PROPOSAL_LOGO_SRC} alt="" style={{ width: 40, height: 12 }} /> },
      });
      expect(pages[0]!.hasImage).toBe(true);
    }, 60_000);

    // The stamp is printed inside the document, where Chromium fills no page
    // counter, so a number there would read the same on every page.
    it("refuses a page counter in the stamp, naming the adapter and the slot", async () => {
      const failure = await renderPdf(<div>Anchor</div>, {
        adapter: "chromium",
        furniture: { stamp: <PageNumber /> },
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UnsupportedFurnitureContentError);
      const error = failure as UnsupportedFurnitureContentError;
      expect(error.adapter).toBe("chromium");
      expect(error.slot).toBe("stamp");
      expect(error.message).toContain('"chromium" adapter');
      expect(error.message).toContain("stamp");
    }, 60_000);
  });

  describe("a document stamped and nothing else", () => {
    it("keeps its page count and carries the stamp on every page", async () => {
      const pages = await chromiumPages(<ProposalDocument data={overflowProposalData} />, {
        images: [logo],
        furniture: { stamp: furniture.stamp },
      });

      expect(pages).toHaveLength(bare.length);
      for (const [index, page] of pages.entries()) {
        expect(page.text).toBe(`${STAMP}${bare[index]!.text}`);
      }
    }, 60_000);
  });
});
