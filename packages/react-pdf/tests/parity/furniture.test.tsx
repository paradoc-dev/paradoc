/**
 * Parity for a furnished page: is the running head, the foot and the stamp on
 * the PDF's page where the preview drew them, on both engines?
 *
 * The proposal is drawn in the lab with its page furniture and every sheet is
 * captured once. The same document with the same furniture is rendered by each
 * engine in hint mode and compared against those captures, page by page. A page
 * passes on:
 *
 * - the page count, which is also the page count of the same document drawn
 *   without furniture, because furniture lives inside the margin;
 * - the first unit, read off the PDF's text once the furniture's own text is
 *   taken out of it, since a running head is not the unit a page opens on;
 * - the furniture's text: the words each sheet's header, footer and stamp drew
 *   in the preview are in the text of that page of the PDF, page number and
 *   all; and
 * - the furniture's ink: each margin strip carries ink in both rasters.
 *
 * On Chromium, the engine that drew the preview, the pixels are held to the
 * same bar as every other parity page, and each margin strip is compared on its
 * own as well: once it may slide a few pixels to meet its counterpart, under
 * `BAND_RESIDUAL_RATIO` of its ink may still differ. On takumi those two are
 * recorded and not asserted. The lab draws the proposal in the application's
 * own typeface, which the default engine refuses by design and replaces with
 * its own, so every glyph on the page differs in shape while standing in the
 * same place; the shape is a finding about the engine, not about furniture.
 *
 * Two controls prove the criteria can fail. The PDF is rendered on each engine
 * with a foot whose words differ from the preview's, and every page fails; and the preview
 * alone loses its foot on one page, and that page fails while the others pass.
 *
 * It is not part of `pnpm test`, like the rest of `tests/parity/`.
 */

import type { Browser } from "puppeteer";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  overflowProposalData,
  ProposalDocument,
  proposalFurniture,
  PROPOSAL_FURNITURE_STAMP,
} from "../../../components/src/examples";
import { proposalLogoImage } from "../../../components/src/examples/pdf";
import { type PageFurniture, pageGeometry, resolveDocumentTokens, DEFAULT_TYPOGRAPHY } from "@paradoc/react";
import { renderPdf, type PdfAdapterName, type PdfImage } from "../../src";
import { closeChromium } from "../../src/adapters/chromium";
import { readPdf, type ReadPage } from "../pdf-reader";
import { normalizeText, treeKeeps, type TreeKeep } from "../pdf-reader";
import {
  CAPTURE_SCALE,
  pdfFirstKeeps,
  previewFirstKeeps,
  RESIDUAL_THRESHOLD_PERCENT,
} from "./criteria";
import { launchBrowser, startLab, type Lab } from "./lab";
import { openPreview, type Preview, type PreviewPlan, type SheetFurniture } from "./preview";
import { openRasterizer, type BandDifference, type Rasterizer } from "./raster";

/**
 * How much of a margin strip's ink may still differ once the strip has slid to
 * meet its counterpart.
 *
 * The same words drawn by the browser and printed by it differ on their
 * antialiased edges, which on 12 pixel grey type is a quarter to under a third
 * of their ink. A strip with its band missing or drawn somewhere else differs
 * on most of it. What this does not separate is one word swapped for another
 * of the same shape, which differs on only the letters that changed; the text
 * criterion is what catches a foot in different words.
 */
const BAND_RESIDUAL_RATIO = 0.5;

/** Fewer inked pixels than this in a strip is a strip with nothing drawn in it. */
const BAND_INK_MINIMUM = 50;

/** The one element both sides draw. */
const TOKENS = { typography: DEFAULT_TYPOGRAPHY };
const element = <ProposalDocument data={overflowProposalData} tokens={TOKENS} />;
const geometry = pageGeometry(resolveDocumentTokens(TOKENS));
const paper = { widthPx: geometry.widthPx, heightPx: geometry.heightPx };

/** What one margin strip of one page came to. */
interface BandVerdict {
  /** Both rasters carry ink in the strip. */
  present: boolean;
  /** The share of the strip's ink still differing once aligned. */
  residual: number;
  /** Present, and under the residual ratio. */
  agrees: boolean;
}

/** One page of one engine's furnished render, judged. */
interface FurnishedPage {
  number: number;
  previewFirstKeep: string | null;
  pdfFirstKeep: string | null;
  /** The preview's furniture words for this sheet that the PDF page does not carry. */
  missingText: string[];
  header: BandVerdict;
  footer: BandVerdict;
  alignedPercent: number;
}

/** One engine's furnished render, judged. */
interface FurnishedRun {
  adapter: PdfAdapterName;
  pdfPages: number;
  pages: FurnishedPage[];
}

let lab: Lab;
let browser: Browser;
let preview: Preview;
let rasterizer: Rasterizer;
let logo: PdfImage;
let barePlan: PreviewPlan;
let furnishedPlan: PreviewPlan;
const runs = new Map<string, FurnishedRun>();

/** One strip's numbers, judged. */
function bandVerdict(band: BandDifference | undefined): BandVerdict {
  if (band === undefined) throw new Error("the comparison was not told the margin");
  const present = band.previewInkPixels > BAND_INK_MINIMUM && band.pdfInkPixels > BAND_INK_MINIMUM;
  const residual = band.alignedPixels / Math.max(1, band.previewInkPixels, band.pdfInkPixels);
  return { present, residual, agrees: present && residual < BAND_RESIDUAL_RATIO };
}

/**
 * A PDF page's text with the furniture's words taken out.
 *
 * A page is identified by the unit its text opens on, and a running head
 * painted before the content would otherwise be read as that unit.
 */
function withoutFurniture(page: ReadPage, furniture: SheetFurniture | undefined): ReadPage {
  // Compared the way the unit match compares, without spacing: the preview's
  // running head joins its two runs where an engine may put a space.
  let text = normalizeText(page.text);
  for (const words of [furniture?.header, furniture?.footer, furniture?.stamp]) {
    if (words) text = text.replace(normalizeText(words), "");
  }
  return { ...page, text };
}

/** The preview's furniture words for one sheet that a PDF page does not carry. */
function missingFurnitureText(page: ReadPage, furniture: SheetFurniture | undefined): string[] {
  const text = normalizeText(page.text);
  return [furniture?.header, furniture?.footer, furniture?.stamp]
    .filter((words): words is string => words !== undefined && words.length > 0)
    .filter((words) => !text.includes(normalizeText(words)));
}

/** Renders the furnished proposal through one engine and judges it against `captures`. */
async function measure(
  adapter: PdfAdapterName,
  furniture: PageFurniture,
  captures: readonly string[],
  keeps: readonly TreeKeep[]
): Promise<FurnishedRun> {
  const plan = furnishedPlan;
  // takumi takes no application typography by design, so it is sent the plan's
  // breaks and repeats alone and sets the page in its own face.
  const rendered = await renderPdf(
    element,
    adapter === "chromium"
      ? {
          adapter,
          images: [logo],
          furniture,
          fonts: plan.fonts.resources,
          applicationCss: plan.fonts.css,
          plan: { breaks: plan.breaks, repeats: plan.repeats, fonts: plan.fonts },
        }
      : { adapter, images: [logo], furniture, plan: { breaks: plan.breaks, repeats: plan.repeats } }
  );
  const read = await readPdf(rendered.bytes);
  const difference = await rasterizer.compare(rendered.bytes, captures, paper, geometry.marginPx);
  const fromPdf = pdfFirstKeeps(
    read.map((page, index) => withoutFurniture(page, plan.furniture[index])),
    keeps
  );
  const fromPreview = previewFirstKeeps(plan, keeps);

  return {
    adapter,
    pdfPages: difference.pdfPageCount,
    pages: difference.pages.map((page) => {
      const index = page.number - 1;
      return {
        number: page.number,
        previewFirstKeep: fromPreview[index] ?? null,
        pdfFirstKeep: fromPdf[index] ?? null,
        missingText: missingFurnitureText(read[index]!, plan.furniture[index]),
        header: bandVerdict(page.furniture?.header),
        footer: bandVerdict(page.furniture?.footer),
        alignedPercent: (page.alignedPixels / page.totalPixels) * 100,
      };
    }),
  };
}

/** The run measured under `name`, or a clear failure if it never was. */
function run(name: string): FurnishedRun {
  const measured = runs.get(name);
  if (measured === undefined) throw new Error(`${name} was not measured`);
  return measured;
}

/** The pages of a run that fail the furniture criteria, one line each. */
function furnitureFailures(measured: FurnishedRun, strict: boolean): string[] {
  return measured.pages
    .filter(
      (page) =>
        page.missingText.length > 0 ||
        !page.header.present ||
        !page.footer.present ||
        (strict && (!page.header.agrees || !page.footer.agrees))
    )
    .map(
      (page) =>
        `page ${page.number}: missing ${JSON.stringify(page.missingText)}, header ` +
        `${page.header.present ? "present" : "absent"} (${page.header.residual.toFixed(2)}), footer ` +
        `${page.footer.present ? "present" : "absent"} (${page.footer.residual.toFixed(2)})`
    );
}

beforeAll(async () => {
  lab = await startLab();
  browser = await launchBrowser();
  preview = await openPreview(browser, lab.url, CAPTURE_SCALE);
  rasterizer = await openRasterizer(browser, lab.url);
  logo = await proposalLogoImage();

  barePlan = await preview.show("proposal", "overflow", "default", paper, undefined, DEFAULT_TYPOGRAPHY, "none");
  furnishedPlan = await preview.show(
    "proposal",
    "overflow",
    "default",
    paper,
    undefined,
    DEFAULT_TYPOGRAPHY,
    "furnished"
  );
  const captures = (await preview.capture()).map((capture) => capture.png);
  const keeps = treeKeeps((await fromJsx(element)).node);

  for (const adapter of ["chromium", "takumi"] as const) {
    runs.set(adapter, await measure(adapter, proposalFurniture(), captures, keeps));
  }

  // The first control, on both engines: the PDF's foot says something else on
  // every page.
  for (const adapter of ["chromium", "takumi"] as const) {
    runs.set(
      `${adapter}/different-footer`,
      await measure(adapter, proposalFurniture({ footerLabel: "Folio" }), captures, keeps)
    );
  }

  // The second: the preview alone loses its foot on page two. Last, because the
  // rule stays on the lab's page.
  await preview.restyle('[data-page="2"] [data-page-footer] { visibility: hidden }', paper);
  const footless = (await preview.capture()).map((capture) => capture.png);
  runs.set("footless-page-two", await measure("chromium", proposalFurniture(), footless, keeps));

  for (const [name, measured] of runs) {
    console.log(`\n${name}: ${measured.pdfPages} PDF pages against ${furnishedPlan.pageCount}`);
    console.table(
      measured.pages.map((page) => ({
        page: page.number,
        first: `${page.previewFirstKeep} / ${page.pdfFirstKeep}`,
        missing: page.missingText.join(", "),
        header: page.header.residual.toFixed(3),
        footer: page.footer.residual.toFixed(3),
        aligned: page.alignedPercent.toFixed(2),
      }))
    );
  }
}, 600_000);

afterAll(async () => {
  await closeChromium();
  await browser?.close();
  await lab?.stop();
});

describe("the furniture itself", () => {
  it("leaves the preview's plan exactly as it is without furniture", () => {
    expect(furnishedPlan.pageCount).toBeGreaterThan(1);
    expect(furnishedPlan.pageCount).toBe(barePlan.pageCount);
    expect(furnishedPlan.breaks).toEqual(barePlan.breaks);
  });

  it("is drawn on every sheet of the preview, numbered", () => {
    expect(furnishedPlan.furniture).toHaveLength(furnishedPlan.pageCount);
    for (const [index, sheet] of furnishedPlan.furniture.entries()) {
      expect(sheet.header.length).toBeGreaterThan(0);
      expect(sheet.stamp).toBe(PROPOSAL_FURNITURE_STAMP);
      expect(sheet.footer).toBe(`Page ${index + 1} of ${furnishedPlan.pageCount}`);
    }
  });
});

describe.each(["chromium", "takumi"] as const)("a furnished proposal on %s", (adapter) => {
  it("gives the PDF the page count the preview drew", () => {
    const measured = run(adapter);
    expect(measured.pdfPages).toBe(furnishedPlan.pageCount);
    expect(measured.pages).toHaveLength(furnishedPlan.pageCount);
  });

  it("starts every page on the unit the preview started it on", () => {
    expect(
      run(adapter)
        .pages.filter(
          (page) =>
            page.previewFirstKeep === null ||
            page.pdfFirstKeep === null ||
            page.previewFirstKeep !== page.pdfFirstKeep
        )
        .map((page) => `page ${page.number}: preview ${page.previewFirstKeep}, pdf ${page.pdfFirstKeep}`)
    ).toEqual([]);
  });

  it("carries every sheet's furniture on its page, in both rasters", () => {
    expect(furnitureFailures(run(adapter), adapter === "chromium")).toEqual([]);
  });
});

describe("a furnished proposal on chromium, pixel for pixel", () => {
  it("lays every page out where the preview laid it out", () => {
    expect(
      run("chromium")
        .pages.filter((page) => page.alignedPercent >= RESIDUAL_THRESHOLD_PERCENT)
        .map((page) => `page ${page.number}: ${page.alignedPercent.toFixed(2)}%`)
    ).toEqual([]);
  });
});

describe("the furniture criteria fail when the furniture differs", () => {
  it.each(["chromium", "takumi"] as const)(
    "fails every page whose foot says something else in %s's PDF",
    (adapter) => {
      const measured = run(`${adapter}/different-footer`);
      const failing = furnitureFailures(measured, adapter === "chromium");
      expect(failing).toHaveLength(measured.pages.length);
      for (const page of measured.pages) {
        // The words are what differ, so the words are what fail it; the head is
        // untouched, so only the foot is named.
        expect(page.missingText).toEqual([`Page ${page.number} of ${furnishedPlan.pageCount}`]);
        expect(adapter === "chromium" ? page.header.agrees : page.header.present).toBe(true);
      }
    }
  );

  it("fails the one page whose foot the preview lost, and only that page", () => {
    const measured = run("footless-page-two");
    expect(furnitureFailures(measured, true).map((line) => line.split(":")[0])).toEqual(["page 2"]);
    expect(measured.pages[1]!.footer.present).toBe(false);
  });
});
