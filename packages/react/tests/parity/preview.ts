/**
 * The preview side of the comparison: the lab's page stack, read and captured.
 *
 * Two things come off this page and nothing else does. The plan, read out of the
 * rendered DOM rather than out of a hook, because the DOM is what a reviewer can
 * check against the screen and it is the same attribute set the PDF path is
 * hinted with. And one image per page at the paper's own size.
 *
 * The capture is only meaningful at scale 1. `Pages` shrinks the sheet with a
 * CSS transform to fit its pane, and a transformed screenshot is a resample: it
 * would compare the PDF against a smoothed copy of the preview and call the
 * blur a difference. So the window is opened wide enough for the pane to hold a
 * full sheet, and the sheet's measured size is asserted against the paper the
 * document's own tokens chose rather than assumed to be US Letter.
 */

import type { Browser, ElementHandle, Page } from "puppeteer";

import type { PageDimensions } from "../../src/lib/tokens";

/** Which sample document the lab is showing. */
export type LabDocument = "proposal" | "arabic-letter";

/** Which of the proposal's data sets the lab is showing. */
export type DataSet = "short" | "overflow";

/** Which token set the lab is showing it under. */
export type Branding = "default" | "branded";

/**
 * Wide enough that the preview pane, which is half the window less its padding,
 * still holds an 816 pixel sheet without scaling it.
 */
const WINDOW_WIDTH = 1900;
const WINDOW_HEIGHT = 1200;

/** What the preview says about its own pages. */
export interface PreviewPlan {
  /** How many sheets the preview drew. */
  pageCount: number;
  /**
   * The keep ids on each page that are the keep's own place in the flow, in
   * DOM order. A page's own keeps and nothing else: anything that reads a page
   * by walking document order instead can walk off the end of it.
   */
  pageKeeps: string[][];
  /**
   * The first keep on each page that is the keep's own place in the flow. A
   * repeated table header is a copy and is read past, or every continued page
   * would report a mismatch against a PDF that names the row.
   */
  firstKeeps: string[];
  /** Copied keep ids on each page, in the shape `renderPdf` takes them. */
  repeats: string[][];
  /** The keep that starts each page from page 2 on. */
  breaks: string[];
}

/** One captured page of the preview. */
export interface PreviewCapture {
  /** 1-based page number. */
  number: number;
  /** PNG bytes, base64, at `deviceScaleFactor` times the paper size. */
  png: string;
}

/** The lab, opened and settled on one data set. */
export interface Preview {
  page: Page;
  /** Shows one document, on `paper`, and waits until its pages are drawn. */
  show: (
    doc: LabDocument,
    set: DataSet,
    branding: Branding,
    paper: PageDimensions
  ) => Promise<PreviewPlan>;
  /** One image per drawn page. */
  capture: () => Promise<PreviewCapture[]>;
  /** Adds a stylesheet to the preview, for the run that proves the suite can fail. */
  restyle: (css: string, paper: PageDimensions) => Promise<void>;
}

/**
 * The variant a published plan is stamped with, and the revision counter that
 * increases every time the lab publishes a new one. Read off the lab's own
 * readout (`[data-plan-revision]`), not off the document sheets: the sheets
 * of a document mid-switch can still be the previous variant's.
 */
interface PlanStamp {
  revision: number;
  document: LabDocument | null;
  dataSet: DataSet | null;
  branding: Branding | null;
}

/**
 * Which document, in which configuration, a plan is a plan of.
 *
 * The document is always part of it. Its data set and token set are the
 * proposal's alone: the Arabic letter has one of each, the lab draws no control
 * for them and stamps neither, so a variant of it is named by its document and
 * two nulls.
 */
export interface VariantStamp {
  document: LabDocument;
  dataSet: DataSet | null;
  branding: Branding | null;
}

/** The stamp the lab publishes for one variant. */
function stampFor(doc: LabDocument, set: DataSet, branding: Branding): VariantStamp {
  return doc === "proposal"
    ? { document: doc, dataSet: set, branding }
    : { document: doc, dataSet: null, branding: null };
}

/** True when a plan already on screen is a plan of the variant being asked for. */
function sameStamp(stamp: PlanStamp, wanted: VariantStamp): boolean {
  return (
    stamp.document === wanted.document &&
    stamp.dataSet === wanted.dataSet &&
    stamp.branding === wanted.branding
  );
}

/**
 * Runs inside the browser. Self-contained on purpose, like `sampleCorners`.
 */
function readPlanStamp(): PlanStamp {
  const readout = document.querySelector("[data-plan-revision]");
  if (readout === null) return { revision: 0, document: null, dataSet: null, branding: null };
  return {
    revision: Number(readout.getAttribute("data-plan-revision")),
    document: readout.getAttribute("data-plan-document") as LabDocument | null,
    dataSet: readout.getAttribute("data-plan-data-set") as DataSet | null,
    branding: readout.getAttribute("data-plan-branding") as Branding | null,
  };
}

/**
 * Reads the plan off the rendered sheets.
 *
 * A preview showing no sheet is not a preview of a document with no pages: it
 * is a preview that has not settled, or one that dropped its plan between the
 * wait and the read. Everything downstream treats an empty page list as
 * vacuously passing, so it is refused here instead.
 *
 * `expected` names the variant this read is supposed to be of. Page count
 * alone cannot tell a fresh plan from the previous variant's: two variants
 * that happen to paginate to the same number of pages read identically by
 * that measure alone. The lab's own stamp can tell them apart, so a plan
 * stamped for a different variant is refused here rather than silently
 * compared as if it were the one asked for.
 */
async function readPlan(page: Page, expected?: VariantStamp): Promise<PreviewPlan> {
  const read = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll("[data-page]")];
    const pageKeeps = sheets.map((sheet) =>
      [...sheet.querySelectorAll("[data-keep-id]")]
        .filter((keep) => keep.getAttribute("data-keep-repeat") !== "true")
        .map((keep) => keep.getAttribute("data-keep-id") ?? "")
    );
    const firstKeeps = pageKeeps.map((keeps) => keeps[0] ?? "");
    const readout = document.querySelector("[data-plan-revision]");
    return {
      pageCount: sheets.length,
      pageKeeps,
      firstKeeps,
      repeats: sheets.map((sheet) =>
        [...sheet.querySelectorAll('[data-keep-id][data-keep-repeat="true"]')].map(
          (keep) => keep.getAttribute("data-keep-id") ?? ""
        )
      ),
      breaks: firstKeeps.slice(1),
      stampedDocument: readout?.getAttribute("data-plan-document") ?? null,
      stampedDataSet: readout?.getAttribute("data-plan-data-set") ?? null,
      stampedBranding: readout?.getAttribute("data-plan-branding") ?? null,
    };
  });

  if (read.pageCount === 0) {
    throw new Error("The preview drew no sheet at all. Nothing measured against it means anything.");
  }

  const name = (stamp: {
    document: string | null;
    dataSet: string | null;
    branding: string | null;
  }) => [stamp.document, stamp.dataSet, stamp.branding].filter(Boolean).join("/") || "no plan";

  if (
    expected !== undefined &&
    (read.stampedDocument !== expected.document ||
      read.stampedDataSet !== expected.dataSet ||
      read.stampedBranding !== expected.branding)
  ) {
    throw new Error(
      `the preview's plan is stamped ${name({
        document: read.stampedDocument,
        dataSet: read.stampedDataSet,
        branding: read.stampedBranding,
      })}, not the requested ${name(expected)}. It has not caught up with the switch.`
    );
  }

  const {
    stampedDocument: _stampedDocument,
    stampedDataSet: _stampedDataSet,
    stampedBranding: _stampedBranding,
    ...plan
  } = read;
  return plan;
}

/**
 * Fails unless the sheets on screen agree in number with the readout that just
 * named the requested variant.
 *
 * The stamp wait above only reads the readout; it never looks at `[data-page]`
 * itself. `Pages` publishes a plan from a layout effect that runs after the
 * commit that renders the sheets it describes, so a stamp naming the right
 * variant should already imply the sheets are there — but "should" is exactly
 * what the page-count race this file already fixed once relied on. Checked
 * once, cheaply, rather than assumed.
 */
async function assertSheetsMatchReadout(page: Page): Promise<void> {
  const { readoutCount, sheetCount } = await page.evaluate(() => {
    const readout = document.querySelector("[data-page-count]");
    return {
      readoutCount: readout === null ? null : Number(readout.getAttribute("data-page-count")),
      sheetCount: document.querySelectorAll("[data-page]").length,
    };
  });
  if (readoutCount === null || sheetCount !== readoutCount) {
    throw new Error(
      `the readout reports ${readoutCount ?? "no"} page(s) but the DOM has ${sheetCount} ` +
        "sheet(s). The plan's stamp changed without the sheets it describes being rendered yet."
    );
  }
}

/**
 * Fails unless every sheet is exactly one sheet of the expected paper on screen.
 *
 * The expected paper comes from the token set the run is measuring, so this is
 * two checks in one: the preview is not being scaled, and the paper the document
 * declared is the paper the furniture drew.
 */
async function assertUnscaled(page: Page, paper: PageDimensions): Promise<void> {
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll("[data-page]")].map((sheet) => {
      const box = sheet.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    })
  );
  if (sizes.length === 0) {
    throw new Error(
      "The preview drew no sheet to measure. A run with nothing on screen passes every " +
        "criterion below without comparing anything."
    );
  }
  const wrong = sizes.filter(
    (size) => size.width !== paper.widthPx || size.height !== paper.heightPx
  );
  if (wrong.length > 0) {
    throw new Error(
      `The preview is scaled or on the wrong paper: sheets measured ` +
        `${JSON.stringify(wrong)} rather than ${paper.widthPx}x${paper.heightPx}. ` +
        "Widen the window the suite opens, or check the document's page-size token."
    );
  }
}

/**
 * How far into each capture the corner sample sits, as a fraction of the
 * screenshot's shorter side.
 *
 * Every reference document's margin — 48 or 56 pixels, on paper 794 to 1123
 * pixels wide — is comfortably wider than this fraction of either side, so a
 * sample this close to a corner always lands on the sheet's own margin and
 * never on a keep's content.
 */
const CORNER_SAMPLE_FRACTION = 0.03;

/** One sampled pixel, as its RGB channels. */
type Corner = readonly [number, number, number];

/**
 * Runs inside the browser. Decodes the capture and reads back its four
 * corners, each inset by `fraction` of the shorter side.
 *
 * Self-contained on purpose: `page.evaluate` sends the source of this
 * function to the page, so it can close over nothing.
 */
async function sampleCorners(base64: string, fraction: number): Promise<Corner[]> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("the capture did not decode"));
    image.src = `data:image/png;base64,${base64}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2d context");
  context.drawImage(image, 0, 0);
  const inset = Math.round(Math.min(canvas.width, canvas.height) * fraction);
  const points: Array<[number, number]> = [
    [inset, inset],
    [canvas.width - inset, inset],
    [inset, canvas.height - inset],
    [canvas.width - inset, canvas.height - inset],
  ];
  return points.map(([x, y]) => {
    const [r, g, b] = context.getImageData(x, y, 1, 1).data;
    return [r ?? 0, g ?? 0, b ?? 0] as const;
  });
}

/** True once a corner reads as the sheet's own paper rather than as ink or frame. */
function isPaperWhite([r, g, b]: Corner): boolean {
  return r >= 250 && g >= 250 && b >= 250;
}

/**
 * Fails a capture that shows the lab's own frame instead of the sheet's paper.
 *
 * `capture()` screenshots the sheet element itself right after switching tabs
 * to it. A sheet that has not painted yet reads back as whatever sat behind it
 * before the switch — the lab's grey frame around the sheet — rather than the
 * paper white every sheet's margin is by design, the same way `readPlan`
 * refuses a preview that drew no sheet at all: a capture that measures nothing
 * would otherwise pass every criterion downstream without comparing anything.
 * All four corners sit inside that margin, so a painted sheet reads white at
 * every one of them; a mistimed capture reads the frame's grey at all four,
 * since nothing about the document painted at all.
 */
export async function assertPainted(page: Page, capture: PreviewCapture): Promise<void> {
  const corners = await page.evaluate(sampleCorners, capture.png, CORNER_SAMPLE_FRACTION);
  if (corners.every((corner) => !isPaperWhite(corner))) {
    throw new Error(
      `page ${capture.number}: every sampled corner reads ${JSON.stringify(corners[0])}, ` +
        "not paper white. The sheet had not painted when it was screenshotted."
    );
  }
}

/** How long `captureWhenPainted` polls a sheet for a painted frame before giving up. */
export const PAINT_POLL_DEADLINE_MS = 15_000;

/** How long `captureWhenPainted` waits between polls once a screenshot comes back blank. */
const PAINT_POLL_INTERVAL_MS = 100;

/**
 * Screenshots `sheet` once it has actually painted, polling rather than
 * trusting a fixed number of frames.
 *
 * Two `requestAnimationFrame` ticks are usually enough for the compositor to
 * catch up after `bringToFront`, but not always: under load a runner can still
 * hand back the lab's own frame instead of the sheet on the first try, and a
 * fixed wait either eats that cost on every capture or still isn't enough on
 * the run that needed more. So each attempt waits two ticks, screenshots, and
 * samples the corners itself; a capture that is not yet paper white is
 * discarded and tried again after a beat, up to `deadlineMs`. `assertPainted`
 * still runs once more on whatever this loop finally accepts, so a mistake in
 * its own corner check fails loudly here rather than silently accepting a bad
 * capture.
 */
export async function captureWhenPainted(
  page: Page,
  sheet: ElementHandle<Element>,
  number: number,
  deadlineMs: number = PAINT_POLL_DEADLINE_MS
): Promise<PreviewCapture> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    // The first is the frame the switch to the tab itself triggers, and the
    // sheet's own paint is scheduled for the one after it.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
    const png = await sheet.screenshot({ type: "png", encoding: "base64" });
    const corners = await page.evaluate(sampleCorners, png, CORNER_SAMPLE_FRACTION);
    if (corners.some((corner) => isPaperWhite(corner))) {
      const capture: PreviewCapture = { number, png };
      await assertPainted(page, capture);
      return capture;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `page ${number}: every sampled corner reads ${JSON.stringify(corners[0])}, ` +
          "not paper white. The sheet had not painted when it was screenshotted."
      );
    }
    await new Promise((resolve) => setTimeout(resolve, PAINT_POLL_INTERVAL_MS));
  }
}

/**
 * Opens the lab and returns the handle the suite drives it with.
 *
 * `deviceScaleFactor` is the capture resolution. The comparison happens at the
 * paper's own size, so anything above 1 is supersampling: both sides are drawn
 * large and averaged down to 816 x 1056, which takes each rasterizer's own
 * antialiasing out of the difference and leaves the geometry.
 */
export async function openPreview(
  browser: Browser,
  labUrl: string,
  deviceScaleFactor: number
): Promise<Preview> {
  const page = await browser.newPage();
  await page.setViewport({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    deviceScaleFactor,
  });
  await page.goto(labUrl, { waitUntil: "networkidle0" });
  await page.waitForSelector("[data-page]", { timeout: 60_000 });

  const show = async (
    doc: LabDocument,
    set: DataSet,
    branding: Branding,
    paper: PageDimensions
  ): Promise<PreviewPlan> => {
    await page.bringToFront();
    const before = await page.evaluate(readPlanStamp);
    // The document is chosen first, because the lab offers the proposal's data
    // set and token set only while the proposal is on screen: the letter has
    // one of each and controls that could not change it are not drawn.
    await page.click(`[data-choice="document"] [data-choice-option="${doc}"]`);
    if (doc === "proposal") {
      // The branding next: it changes the paper, and a plan measured on one
      // paper and captured on another would compare two documents.
      await page.click(`[data-choice="branding"] [data-choice-option="${branding}"]`);
      await page.click(`[data-choice="data-set"] [data-choice-option="${set}"]`);
    }
    // If the readout already names the variant being asked for, nothing was
    // switched — the clicks landed on the options already selected, as the
    // very first call always does — and there is no later plan to wait for.
    // Waiting on a page count alone cannot tell "this plan is fresh" from
    // "this plan is the previous variant's, and just happens to paginate to
    // the same number of pages", which is exactly how a stale plan passed
    // this wait before: the readout's own variant and revision can.
    const wanted = stampFor(doc, set, branding);
    if (!sameStamp(before, wanted)) {
      await page.waitForFunction(
        (expected: VariantStamp, baselineRevision: number) => {
          const readout = document.querySelector("[data-plan-revision]");
          if (readout === null) return false;
          const revision = Number(readout.getAttribute("data-plan-revision"));
          return (
            revision > baselineRevision &&
            readout.getAttribute("data-plan-document") === expected.document &&
            // The proposal's data set and token set are the proposal's alone.
            // The letter has one of each and the lab stamps neither, so a wait
            // that insisted on them would never be satisfied.
            readout.getAttribute("data-plan-data-set") === expected.dataSet &&
            readout.getAttribute("data-plan-branding") === expected.branding
          );
        },
        // Polled on a timer rather than on animation frames. The suite also holds
        // a rasterizing tab, and a browser that is not showing this one stops
        // producing frames for it, which would leave a frame-polled wait hanging.
        { timeout: 60_000, polling: 100 },
        wanted,
        before.revision
      );
    }
    // Belt and braces: `Pages` publishes the plan from a layout effect that
    // runs after the commit that renders the sheets, so a stamp naming the
    // right variant should already mean the sheets are there. Assert it
    // rather than assume it, once, cheaply, the same way the wait above
    // stopped trusting a number that could describe a DOM that was not yet
    // real.
    await assertSheetsMatchReadout(page);
    await assertUnscaled(page, paper);
    return readPlan(page, stampFor(doc, set, branding));
  };

  const capture = async (): Promise<PreviewCapture[]> => {
    // A tab that is not on top stops receiving frames from the compositor;
    // this makes it the foreground tab again. `captureWhenPainted` below is
    // what actually waits for a frame to be drawn against the current DOM
    // before trusting a screenshot.
    await page.bringToFront();
    const { pageCount } = await readPlan(page);
    const captures: PreviewCapture[] = [];
    for (let number = 1; number <= pageCount; number++) {
      const sheet = await page.$(`[data-page="${number}"]`);
      if (sheet === null) throw new Error(`the preview has no page ${number}`);
      captures.push(await captureWhenPainted(page, sheet, number));
    }
    return captures;
  };

  const restyle = async (css: string, paper: PageDimensions): Promise<void> => {
    await page.bringToFront();
    await page.addStyleTag({ content: css });
    // A repaint, not a repagination: the caller's rule must not move a keep,
    // or the comparison would be against a different document.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    await assertUnscaled(page, paper);
  };

  return { page, show, capture, restyle };
}
