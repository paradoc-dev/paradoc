/**
 * A DRAFT watermark on every page, on both engines, read back as a reader sees
 * it.
 *
 * The stamp the docs and the skill show: large, light text turned to rise
 * across the sheet and centred on it. Each engine is held to the same four
 * things. The stamp is on every page. It is turned the way the class says,
 * read off the text matrix the engine wrote. It is centred on the sheet, with
 * a running head beside it or without one. And the document paginates exactly
 * as it does bare. A stamp taller than the sheet it is drawn across, or with a
 * word or a line held together wider than it, is refused by name on both,
 * rather than cut off at the paper's edge on every page.
 *
 * The Chromium half needs a Chrome, like `pdf-chromium-furniture.test.tsx`,
 * and opts out the same way.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overflowProposalData, ProposalDocument } from "../../components/src/examples";
import { proposalLogoImage } from "../../components/src/examples/pdf";
import { type PageFurniture, PAGE_SIZES } from "@paradoc/react";
import {
  PageFurnitureOverflowError,
  PageStampTooWideError,
  renderPdf,
  type PdfAdapterName,
  type PdfImage,
} from "../src";
import { chromiumExecutable, closeChromium } from "../src/adapters/chromium";
import { readPdf, type ReadItem, type ReadPage } from "./pdf-reader";

const STAMP = "DRAFT";
const HEADER = "Northwind Partners LLP";

/** The documented watermark. */
const stamp = <span className="-rotate-45 text-9xl font-bold text-neutral-200">{STAMP}</span>;

/** How far the stamp's baseline may sit from the sheet's centre, per axis. */
const CENTRE_TOLERANCE_PX = 64;

const skipChromium = process.env.PARADOC_SKIP_CHROMIUM_TESTS === "1";
const adapters: PdfAdapterName[] = skipChromium ? ["takumi"] : ["takumi", "chromium"];

let logo: PdfImage;

/** The proposal on one engine, read back. */
async function proposal(adapter: PdfAdapterName, furniture?: PageFurniture): Promise<ReadPage[]> {
  const document = <ProposalDocument data={overflowProposalData} />;
  return readPdf((await renderPdf(document, { adapter, images: [logo], furniture })).bytes);
}

/**
 * The runs the stamp is drawn in, in order.
 *
 * Chromium writes a word as several runs wherever its shaper split it, so the
 * stamp is the page's leading runs that spell it, not one run that holds it.
 */
function stampRuns(page: ReadPage): ReadItem[] {
  const runs: ReadItem[] = [];
  let spelled = "";
  for (const item of page.items) {
    if (spelled === STAMP || !STAMP.startsWith(spelled + item.text)) break;
    runs.push(item);
    spelled += item.text;
  }
  return spelled === STAMP ? runs : [];
}

/**
 * The run a piece of text starts at: the item from which the page's text
 * begins with it, since an engine may split one line into several runs.
 */
function runStart(page: ReadPage, text: string): ReadItem | undefined {
  return page.items.find((_item, index) =>
    page.items
      .slice(index)
      .map((item) => item.text)
      .join("")
      .startsWith(text)
  );
}

/** The middle of the stamp's baseline, from the first run's start to the last run's end. */
function baselineMiddle(runs: readonly ReadItem[]): { x: number; y: number } {
  const first = runs[0]!;
  const last = runs.at(-1)!;
  const radians = (last.angleDeg * Math.PI) / 180;
  const endX = last.leftPx + last.widthPx * Math.cos(radians);
  const endY = last.topPx - last.widthPx * Math.sin(radians);
  return { x: (first.leftPx + endX) / 2, y: (first.topPx + endY) / 2 };
}

beforeAll(async () => {
  logo = await proposalLogoImage();
  if (!skipChromium && (await chromiumExecutable()) === undefined) {
    throw new Error(
      "The stamp tests need a Chrome for the Chromium adapter: set PUPPETEER_EXECUTABLE_PATH, " +
        "or set PARADOC_SKIP_CHROMIUM_TESTS=1 to opt out of that half deliberately."
    );
  }
});

afterAll(async () => {
  await closeChromium();
});

describe.each(adapters)("a DRAFT watermark on %s", (adapter) => {
  let bare: ReadPage[];
  let stamped: ReadPage[];
  let headed: ReadPage[];
  let headOnly: ReadPage[];

  beforeAll(async () => {
    [bare, stamped, headed, headOnly] = await Promise.all([
      proposal(adapter),
      proposal(adapter, { stamp }),
      proposal(adapter, { header: <span>{HEADER}</span>, stamp }),
      proposal(adapter, { header: <span>{HEADER}</span> }),
    ]);
  }, 120_000);

  it("is on every page, and leaves the page count and every page's content as they were", () => {
    expect(bare.length).toBeGreaterThan(1);
    expect(stamped).toHaveLength(bare.length);
    for (const [index, page] of stamped.entries()) {
      // Painted first, because it is behind the content.
      expect(page.text).toBe(`${STAMP}${bare[index]!.text}`);
    }
  });

  it("is turned to rise across the sheet on every page", () => {
    for (const page of stamped) {
      const runs = stampRuns(page);
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) expect(run.angleDeg).toBeCloseTo(45, 0);
    }
  });

  it.each([
    ["alone", () => stamped],
    ["beside a running head", () => headed],
  ] as const)("is centred on the sheet %s", (_label, pages) => {
    const { widthPx, heightPx } = PAGE_SIZES.letter;
    for (const page of pages()) {
      const middle = baselineMiddle(stampRuns(page));
      expect(Math.abs(middle.x - widthPx / 2)).toBeLessThan(CENTRE_TOLERANCE_PX);
      expect(Math.abs(middle.y - heightPx / 2)).toBeLessThan(CENTRE_TOLERANCE_PX);
    }
  });

  it("leaves the running head exactly where it is drawn without a stamp", () => {
    expect(headed).toHaveLength(bare.length);
    for (const [index, page] of headed.entries()) {
      const head = runStart(page, HEADER);
      const alone = runStart(headOnly[index]!, HEADER)!;
      expect(head?.angleDeg).toBe(0);
      expect(Math.abs(head!.topPx - alone.topPx)).toBeLessThan(1);
      expect(Math.abs(head!.leftPx - alone.leftPx)).toBeLessThan(1);
    }
  });

  it("refuses a stamp taller than the sheet, naming the slot, its height and the sheet's", async () => {
    const tall = <span className="text-9xl text-neutral-200">{`${STAMP} `.repeat(40)}</span>;
    const error = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter,
      images: [logo],
      furniture: { stamp: tall },
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PageFurnitureOverflowError);
    const overflow = error as PageFurnitureOverflowError;
    expect(overflow.slot).toBe("stamp");
    expect(overflow.budgetPx).toBe(PAGE_SIZES.letter.heightPx);
    expect(overflow.heightPx).toBeGreaterThan(overflow.budgetPx);
    expect(overflow.message).toContain(`stamp is ${overflow.heightPx} px tall`);
    expect(overflow.message).toContain(`${PAGE_SIZES.letter.heightPx} px sheet`);
  }, 60_000);

  it("refuses a stamp with a word wider than the sheet, naming the sheet's width", async () => {
    // One line, far shorter than the sheet, but the word cannot wrap.
    const wide = <span className="text-9xl text-neutral-200">CONFIDENTIAL</span>;
    const error = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter,
      images: [logo],
      furniture: { stamp: wide },
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PageStampTooWideError);
    const tooWide = error as PageStampTooWideError;
    expect(tooWide.slot).toBe("stamp");
    expect(tooWide.sheetWidthPx).toBe(PAGE_SIZES.letter.widthPx);
    expect(tooWide.message).toContain(`${PAGE_SIZES.letter.widthPx} px sheet`);
  }, 60_000);

  it("refuses a stamp held to one line wider than the sheet, naming the sheet's width", async () => {
    // Every word fits, but the line is held together and runs past both edges.
    const wide = (
      <span className="whitespace-nowrap text-9xl text-neutral-200">DRAFT CONFIDENTIAL DO NOT DISTRIBUTE</span>
    );
    const error = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter,
      images: [logo],
      furniture: { stamp: wide },
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PageStampTooWideError);
    expect((error as PageStampTooWideError).sheetWidthPx).toBe(PAGE_SIZES.letter.widthPx);
  }, 60_000);

  it("draws a stamp held to one line that fits the sheet", async () => {
    const fits = <span className="whitespace-nowrap text-6xl text-neutral-200">{`${STAMP} COPY`}</span>;
    const { bytes } = await renderPdf(<ProposalDocument data={overflowProposalData} />, {
      adapter,
      images: [logo],
      furniture: { stamp: fits },
    });
    const pages = await readPdf(bytes);
    expect(pages).toHaveLength(bare.length);
    for (const [index, page] of pages.entries()) {
      expect(page.text).toBe(`${STAMP} COPY${bare[index]!.text}`);
    }
  }, 60_000);
});
