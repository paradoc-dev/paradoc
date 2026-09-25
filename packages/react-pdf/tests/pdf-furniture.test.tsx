/**
 * Page furniture on the default engine, read back as a reader sees it.
 *
 * The criterion the specification states is not "the band was handed to the
 * engine": it is that every page of the file carries the running head, the foot
 * with its own number, and the stamp — and that the document paginates exactly
 * as it does without any of them. So every assertion here opens the rendered
 * PDF with pdfjs-dist and compares it against the same document rendered bare.
 *
 * The placement assertions are the guard on `FURNITURE_EDGE_INSET_PX`. The
 * constant is a placement rule the preview follows too, and the only thing that
 * can keep it true is a test that reads where this engine actually drew the
 * band.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { PageNumber } from "../../components/src/components/page-number";
import {
  ProposalDocument,
  overflowProposalData,
  PROPOSAL_LOGO_SRC,
} from "../../components/src/examples";
import { proposalLogoImage } from "../../components/src/examples/pdf";
import {
  PageFurnitureOverflowError,
  renderPdf,
  UnsupportedFurnitureError,
  UnsupportedPdfContentError,
  type PdfAdapter,
} from "../src";
import {
  furnitureBandBudgetPx,
  FURNITURE_EDGE_INSET_PX,
  type PageFurniture,
  DEFAULT_PAGE_MARGIN_PX,
  PAGE_SIZES,
} from "@paradoc/react";
import {
  measureFurnitureBands,
  translateFurniture,
} from "../src/adapters/takumi-furniture";
import { readPdf, type ReadPage } from "./pdf-reader";

const HEADER = "Northwind Partners LLP";
const STAMP = "DRAFT";

/** The three slots a finished document carries. */
const furniture: PageFurniture = {
  header: <div className="flex justify-between"><span>{HEADER}</span></div>,
  footer: <PageNumber />,
  stamp: <span className="text-4xl text-neutral-200">{STAMP}</span>,
};

let logo: Awaited<ReturnType<typeof proposalLogoImage>>;
let furnished: ReadPage[];
let bare: ReadPage[];

/** The same proposal, with and without its furniture. */
beforeAll(async () => {
  logo = await proposalLogoImage();
  const document = <ProposalDocument data={overflowProposalData} />;
  furnished = await readPdf((await renderPdf(document, { images: [logo], furniture })).bytes);
  bare = await readPdf((await renderPdf(document, { images: [logo] })).bytes);
}, 120_000);

describe("page furniture on the default engine", () => {
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
      const band = `${STAMP}${HEADER}`;
      const foot = `Page ${page.number} of ${furnished.length}`;
      expect(page.text).toBe(`${band}${bare[index]!.text}${foot}`);
    }
  });

  it("draws the bands inside the margin, clear of the content box", () => {
    const { heightPx } = PAGE_SIZES.letter;
    for (const page of furnished) {
      const header = page.items.find((item) => item.text.includes(HEADER));
      const footer = page.items.find((item) => item.text.trim() === "Page");
      const bareFirst = bare[page.number - 1]!.items[0]!;
      const firstLine = page.items.find((item) => item.text === bareFirst.text);
      expect(header?.topPx).toBeGreaterThanOrEqual(FURNITURE_EDGE_INSET_PX);
      expect(header?.topPx).toBeLessThanOrEqual(DEFAULT_PAGE_MARGIN_PX);
      expect(footer?.topPx).toBeGreaterThanOrEqual(heightPx - DEFAULT_PAGE_MARGIN_PX);
      expect(footer?.topPx).toBeLessThanOrEqual(heightPx - FURNITURE_EDGE_INSET_PX);
      // The content box is untouched: the first line of the page is still where
      // the bare render put it, to the pixel.
      expect(firstLine?.topPx).toBe(bareFirst.topPx);
      expect(firstLine?.leftPx).toBe(bareFirst.leftPx);
    }
  });

  /**
   * The band's top edge, solved out of two renders rather than read off one.
   *
   * A rendered page gives back a baseline, which is the band's top plus a
   * distance that depends on the type the band is set in. Set the same band at
   * two sizes with the leading pinned to the type size, and that distance is
   * simply proportional to the size: two baselines, two equations, and the top
   * edge falls out as `2 * small - large` when the large is twice the small.
   * That is what pins `FURNITURE_EDGE_INSET_PX` to where the engine actually
   * draws, which is the number the preview copies.
   */
  it("puts the band's top edge exactly at the inset both outputs draw at", async () => {
    const baselineAt = async (fontSize: number) => {
      const { bytes } = await renderPdf(<div>Anchor</div>, {
        // A wide margin, so neither band is cut short by the overflow refusal.
        // The inset is the same at either margin, which is half of what this
        // proves.
        tokens: { marginPx: 96 },
        furniture: { header: <span style={{ fontSize, lineHeight: 1 }}>{HEADER}</span> },
      });
      const [page] = await readPdf(bytes);
      return page!.items.find((item) => item.text.includes(HEADER))!.topPx;
    };

    const small = await baselineAt(12);
    const large = await baselineAt(24);
    expect(2 * small - large).toBeCloseTo(FURNITURE_EDGE_INSET_PX, 0);
  }, 60_000);

  it("indents the band to the document's own margin, not to the paper's edge", () => {
    const header = furnished[0]!.items.find((item) => item.text.includes(HEADER));
    expect(header?.leftPx).toBeCloseTo(DEFAULT_PAGE_MARGIN_PX, 0);
  });

  it("paints the stamp before the content, so it sits behind it", () => {
    for (const page of furnished) {
      expect(page.items.findIndex((item) => item.text.includes(STAMP))).toBe(0);
    }
  });

  // The stamp rides a band that starts one inset below the paper's top edge, so
  // the layer is pulled back up by that inset. The window here is narrower than
  // the inset itself: without the correction the stamp lands a whole inset low
  // and this fails.
  it("centres the stamp on the paper rather than on the band it rides in", () => {
    const { heightPx } = PAGE_SIZES.letter;
    const stamp = furnished[0]!.items.find((item) => item.text.includes(STAMP))!;
    expect(Math.abs(stamp.topPx - heightPx / 2)).toBeLessThan(FURNITURE_EDGE_INSET_PX);
  });
});

describe("furniture that cannot be drawn", () => {
  const document = <ProposalDocument data={overflowProposalData} />;

  it("refuses a footer taller than the margin, naming the slot and the heights", async () => {
    const tall = <div style={{ height: 80 }}>Too much foot</div>;
    const failure = await renderPdf(document, {
      images: [logo],
      furniture: { footer: tall },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(PageFurnitureOverflowError);
    const error = failure as PageFurnitureOverflowError;
    expect(error.slot).toBe("footer");
    expect(error.heightPx).toBe(80);
    expect(error.marginPx).toBe(DEFAULT_PAGE_MARGIN_PX);
    expect(error.budgetPx).toBe(DEFAULT_PAGE_MARGIN_PX - FURNITURE_EDGE_INSET_PX);
    expect(error.message).toContain("footer");
    expect(error.message).toContain("80 px");
    expect(error.message).toContain(`${DEFAULT_PAGE_MARGIN_PX} px margin`);
  }, 60_000);

  it("accepts a band that exactly fills the margin's budget", async () => {
    const exact = <div style={{ height: DEFAULT_PAGE_MARGIN_PX - FURNITURE_EDGE_INSET_PX }}>Snug</div>;
    const pages = await readPdf(
      (await renderPdf(document, { images: [logo], furniture: { header: exact } })).bytes
    );
    expect(pages[0]!.text).toContain("Snug");
  }, 60_000);

  it("refuses a class in a band the engine cannot express, naming the class", async () => {
    const failure = await renderPdf(document, {
      images: [logo],
      furniture: { header: <span className="align-super">Defined term</span> },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnsupportedPdfContentError);
    expect((failure as UnsupportedPdfContentError).classes).toContain("align-super");
  }, 60_000);

  it("refuses an image in a band the render supplied no bytes for, naming it", async () => {
    const failure = await renderPdf(document, {
      images: [],
      furniture: { header: <img src={PROPOSAL_LOGO_SRC} alt="" width={40} height={12} /> },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnsupportedPdfContentError);
    expect((failure as UnsupportedPdfContentError).images).toContain(PROPOSAL_LOGO_SRC);
  }, 60_000);
});

describe("a document stamped and nothing else", () => {
  it("keeps its page count and carries the stamp on every page", async () => {
    const pages = await readPdf(
      (
        await renderPdf(<ProposalDocument data={overflowProposalData} />, {
          images: [logo],
          furniture: { stamp: <span className="text-4xl text-neutral-200">{STAMP}</span> },
        })
      ).bytes
    );

    expect(pages).toHaveLength(bare.length);
    for (const [index, page] of pages.entries()) {
      expect(page.text).toBe(`${STAMP}${bare[index]!.text}`);
    }
  }, 60_000);
});

describe("how much margin a band may take", () => {
  it("is the margin less the inset, and never below zero", () => {
    expect(furnitureBandBudgetPx(DEFAULT_PAGE_MARGIN_PX)).toBe(
      DEFAULT_PAGE_MARGIN_PX - FURNITURE_EDGE_INSET_PX
    );
    // A margin narrower than the inset leaves no band at all rather than a
    // negative budget that would compare as "anything fits".
    expect(furnitureBandBudgetPx(FURNITURE_EDGE_INSET_PX - 10)).toBe(0);
  });
});

describe("the band a stamp rides in", () => {
  const geometry = {
    widthPx: PAGE_SIZES.letter.widthPx,
    heightPx: PAGE_SIZES.letter.heightPx,
    marginPx: DEFAULT_PAGE_MARGIN_PX,
  };

  /** The bands the engine is handed for one set of slots. */
  async function bandsFor(slots: PageFurniture) {
    const translated = await translateFurniture(slots, {
      geometry,
      imageSources: [],
    });
    return measureFurnitureBands(translated, geometry, async () => 16);
  }

  // A band clips what overflows it, and a running head is a line or two tall,
  // so a whole-sheet stamp inside an unstretched band is written into the page
  // and then cut away to nothing — present in the text, invisible on paper.
  // Reading the text back cannot see that, so the height is asserted here.
  it("is stretched to the height of the paper, so the layer is not clipped away", async () => {
    const bands = await bandsFor({ header: <span>{HEADER}</span>, stamp: <span>{STAMP}</span> });
    expect(bands.header?.style?.height).toBe(PAGE_SIZES.letter.heightPx);
  });

  it("is left at its own height when there is no stamp to carry", async () => {
    const bands = await bandsFor({ header: <span>{HEADER}</span> });
    expect(bands.header?.style?.height).toBeUndefined();
  });

  // A slot is resolved by the same function the document tree is, and that
  // function hands back whatever `<style>` the markup declared. Dropping it
  // would be a band rendered without the rules it was written against, with
  // nothing to say so.
  it("carries a stylesheet the slot's own markup declared", async () => {
    const translated = await translateFurniture(
      { header: <div><style>{"i { color: #445566 }"}</style><i>{HEADER}</i></div> },
      { geometry, imageSources: [] }
    );
    expect(translated.stylesheets).toEqual(["i { color: #445566 }"]);
    expect(translated.unsupportedClasses).toEqual([]);
  });

  // The two assertions above prove the stylesheet is collected; this proves it
  // reaches the engine, which collecting it alone does not.
  it("changes the rendered bytes, so the rule reached the engine", async () => {
    const head = (styled: boolean) => (
      <div>
        {styled ? <style>{"i { color: #ff0000 }"}</style> : null}
        <i>{HEADER}</i>
      </div>
    );
    const bytesOf = async (styled: boolean) =>
      (await renderPdf(<div>Anchor</div>, { furniture: { header: head(styled) } })).bytes;

    expect(await bytesOf(true)).not.toEqual(await bytesOf(false));
  }, 60_000);

  it("carries none when no slot declared one", async () => {
    const translated = await translateFurniture(
      { header: <span>{HEADER}</span> },
      { geometry, imageSources: [] }
    );
    expect(translated.stylesheets).toEqual([]);
  });
});

describe("an engine that does not draw every slot", () => {
  /** An engine that repeats a head and nothing else, and records what it got. */
  function headerOnly(): PdfAdapter & { drew: boolean } {
    const adapter = {
      name: "header-only-engine",
      directions: ["ltr"] as const,
      furniture: ["header"] as const,
      drew: false,
      async render() {
        adapter.drew = true;
        return { bytes: new Uint8Array([1]), unknownBreaks: [], unknownRepeats: [] };
      },
    };
    return adapter;
  }

  it("refuses the render naming the adapter and every slot it drops", async () => {
    const adapter = headerOnly();
    const failure = await renderPdf(<div>Contract</div>, {
      adapter,
      furniture: { header: <span>Head</span>, footer: <PageNumber />, stamp: <span>{STAMP}</span> },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UnsupportedFurnitureError);
    expect((failure as UnsupportedFurnitureError).adapter).toBe("header-only-engine");
    expect((failure as UnsupportedFurnitureError).slots).toEqual(["footer", "stamp"]);
    // The refusal is before the bytes, not after them.
    expect(adapter.drew).toBe(false);
  });

  it("renders through the same engine when it draws every slot declared", async () => {
    const adapter = headerOnly();
    await renderPdf(<div>Contract</div>, { adapter, furniture: { header: <span>Head</span> } });
    expect(adapter.drew).toBe(true);
  });
});

describe("a page number outside a paginated preview", () => {
  it("still numbers the pages, because the engine fills the counters", async () => {
    const pages = await readPdf(
      (
        await renderPdf(<ProposalDocument data={overflowProposalData} />, {
          images: [logo],
          furniture: { footer: <PageNumber label="" separator="/" /> },
        })
      ).bytes
    );
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.text).toContain(`${page.number} / ${pages.length}`);
  }, 60_000);
});
