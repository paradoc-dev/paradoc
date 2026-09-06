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

import type { Browser, ElementHandle, ElementScreenshotOptions, Page } from "puppeteer";

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
 * Runs inside the browser. Self-contained on purpose, like `sampleCapture`.
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

/** What one capture reads back as: the corners inside the sheet, and its own border. */
export interface CaptureSample {
  /** Four points, each inset by `CORNER_SAMPLE_FRACTION` of the shorter side. */
  corners: Corner[];
  /**
   * Points along the capture's own outermost row, column, last row and last
   * column, away from the corners themselves.
   */
  border: Corner[];
}

/**
 * Runs inside the browser. Decodes the capture and reads back the two sets of
 * points the guards below judge it by.
 *
 * Self-contained on purpose: `page.evaluate` sends the source of this
 * function to the page, so it can close over nothing.
 */
async function sampleCapture(base64: string, fraction: number): Promise<CaptureSample> {
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
  const read = ([x, y]: [number, number]): Corner => {
    const [r, g, b] = context.getImageData(x, y, 1, 1).data;
    return [r ?? 0, g ?? 0, b ?? 0] as const;
  };

  const inset = Math.round(Math.min(canvas.width, canvas.height) * fraction);
  const corners: Array<[number, number]> = [
    [inset, inset],
    [canvas.width - inset, inset],
    [inset, canvas.height - inset],
    [canvas.width - inset, canvas.height - inset],
  ];

  // Spread across the middle of each edge rather than at its ends, so a shadow
  // bleeding round a corner is never mistaken for the frame, and at three
  // depths rather than on the outermost row alone. Not the outermost row,
  // because a clip whose own coordinates are not whole pixels leaves it a blend
  // of what is on either side of the boundary. Not one depth, because what a
  // misplaced clip brings in depends on how far it is out: the frame's own 24
  // pixels of padding and the 24 pixel gap between sheets sit immediately
  // outside every sheet, so three depths inside that catch a clip anywhere from
  // two pixels out to the whole of it.
  const across = [0.2, 0.35, 0.5, 0.65, 0.8];
  const depths = [2, 8, 20];
  const border: Array<[number, number]> = [];
  for (const at of across) {
    const x = Math.round(canvas.width * at);
    const y = Math.round(canvas.height * at);
    for (const depth of depths) {
      border.push([x, depth], [x, canvas.height - 1 - depth]);
      border.push([depth, y], [canvas.width - 1 - depth, y]);
    }
  }

  return { corners: corners.map(read), border: border.map(read) };
}

/** True once a sampled pixel reads as the sheet's own paper rather than as ink or frame. */
function isPaperWhite([r, g, b]: Corner): boolean {
  return r >= 250 && g >= 250 && b >= 250;
}

/**
 * Fails a capture that shows the lab's own frame instead of the sheet's paper.
 *
 * Two ways a capture can be of something other than the sheet, and both are
 * refused here rather than measured.
 *
 * **Nothing painted.** `capture()` screenshots the sheet element right after
 * switching tabs to it, and a sheet that has not painted yet reads back as
 * whatever sat behind it — the lab's grey frame — rather than the paper white
 * every sheet's margin is by design. All four corner samples sit inside that
 * margin, so a painted sheet reads white at every one of them and a capture of
 * nothing reads the frame's grey at all four.
 *
 * **The clip did not sit on the sheet.** A capture the right size can still be
 * taken from the wrong place: `ElementHandle.screenshot` scrolls a sheet the
 * viewport cannot hold wholly into view and then clips at the position that
 * scroll left, which is a position the page may not have painted yet, and the
 * capture comes back with a band of the frame along one edge and the whole
 * document that many pixels out of place. The corner samples are 3 percent in
 * and see nothing of a band that thin, so the capture's own border is checked
 * too: every point of it is the sheet's blank margin, and a point that is not
 * is the frame the clip overhung onto. Left silent, this is the failure that
 * measured the branded variant's page 1 at 7.73 percent ink against the 6.31
 * percent the same page measures when the clip is on the sheet.
 */
export async function assertPainted(page: Page, capture: PreviewCapture): Promise<void> {
  const sample = await page.evaluate(sampleCapture, capture.png, CORNER_SAMPLE_FRACTION);
  if (sample.corners.every((corner) => !isPaperWhite(corner))) {
    throw new Error(
      `page ${capture.number}: every sampled corner reads ${JSON.stringify(sample.corners[0])}, ` +
        "not paper white. The sheet had not painted when it was screenshotted."
    );
  }
  const overhang = sample.border.filter((point) => !isPaperWhite(point));
  if (overhang.length > 0) {
    throw new Error(
      `page ${capture.number}: the capture's own border reads ${JSON.stringify(overhang[0])}, ` +
        "not the sheet's blank margin. The clip did not sit on the sheet, so the document in " +
        "this capture is offset from the page it is supposed to be."
    );
  }
}

/** How long `captureWhenPainted` polls a sheet for a painted frame before giving up. */
export const PAINT_POLL_DEADLINE_MS = 15_000;

/** How long `captureWhenPainted` waits between polls once a screenshot comes back blank. */
const PAINT_POLL_INTERVAL_MS = 100;

/**
 * Scrolls `sheet` wholly into view and waits for the browser to draw it there.
 *
 * The scroll belongs to the suite rather than to the screenshot. A sheet the
 * viewport cannot hold — the A4 paper the branded token set chooses is 1123
 * pixels tall against the pane's 1139, once the lab's own header is above it —
 * is one `ElementHandle.screenshot` scrolls into view itself, on its way to
 * reading the box it will clip at. That scroll and the frame that paints it are
 * not the same event, and on a loaded runner the capture is taken from the
 * frame before it: the clip is where the sheet now is and the pixels are where
 * it was, so the whole page comes back offset by exactly the scroll, with the
 * frame above the sheet along the capture's top edge. Every Letter-sized sheet
 * fits and never triggered it, which is why the branded variant's page 1 was
 * the only page in the suite that ever measured wrong.
 *
 * So the sheet is put where it will be captured first, two frames are allowed
 * to pass, and the screenshot is told not to scroll. Nothing moves between the
 * clip and the capture, because nothing is left to move it.
 */
async function placeInViewport(page: Page, sheet: ElementHandle<Element>): Promise<void> {
  await sheet.evaluate((element: Element) => {
    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  });
  // The first is the frame the scroll and the switch to the tab trigger; the
  // sheet's own paint is scheduled for the one after it.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

/**
 * Screenshots `sheet` once it has actually painted where it will be clipped,
 * polling rather than trusting a fixed number of frames.
 *
 * Two `requestAnimationFrame` ticks are usually enough for the compositor to
 * catch up after `bringToFront`, but not always: under load a runner can still
 * hand back the lab's own frame instead of the sheet on the first try, and a
 * fixed wait either eats that cost on every capture or still isn't enough on
 * the run that needed more. So each attempt places the sheet, waits two ticks,
 * screenshots, and reads the capture back itself; one that is not yet paper
 * white, or whose border shows the clip overhung the sheet, is discarded and
 * tried again after a beat, up to `deadlineMs`. `assertPainted` still runs once
 * more on whatever this loop finally accepts, so a mistake in its own check
 * fails loudly here rather than silently accepting a bad capture.
 */
export async function captureWhenPainted(
  page: Page,
  sheet: ElementHandle<Element>,
  number: number,
  deadlineMs: number = PAINT_POLL_DEADLINE_MS
): Promise<PreviewCapture> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    await placeInViewport(page, sheet);
    // Typed as `ElementScreenshotOptions` rather than passed as a literal:
    // `ElementHandle.screenshot`'s own overloads still declare the narrower
    // `ScreenshotOptions`, which does not name the option the method reads.
    const options: ElementScreenshotOptions & { encoding: "base64" } = {
      type: "png",
      encoding: "base64",
      // The suite has already put the sheet where this clip will be taken. A
      // second scroll here is the one that could move it after the box is read.
      scrollIntoView: false,
    };
    const png = await sheet.screenshot(options);
    const sample = await page.evaluate(sampleCapture, png, CORNER_SAMPLE_FRACTION);
    const painted = sample.corners.some((corner) => isPaperWhite(corner));
    const onTheSheet = sample.border.every((point) => isPaperWhite(point));
    if (painted && onTheSheet) {
      const capture: PreviewCapture = { number, png };
      await assertPainted(page, capture);
      return capture;
    }
    if (Date.now() >= deadline) {
      // Out of time. Whichever of the two the last attempt failed, this says so
      // in the words that name the cause; a capture that satisfies both by now
      // is simply accepted.
      const capture: PreviewCapture = { number, png };
      await assertPainted(page, capture);
      return capture;
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
