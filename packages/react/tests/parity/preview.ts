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

import type { Browser, Page } from "puppeteer";

import type { PageDimensions } from "../../src/lib/tokens";

/** Which sample document the lab is showing. */
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
  /** Shows `set` under `branding` on `paper`, and waits until its pages are drawn. */
  show: (set: DataSet, branding: Branding, paper: PageDimensions) => Promise<PreviewPlan>;
  /** One image per drawn page. */
  capture: () => Promise<PreviewCapture[]>;
  /** Adds a stylesheet to the preview, for the run that proves the suite can fail. */
  restyle: (css: string, paper: PageDimensions) => Promise<void>;
}

/**
 * Reads the plan off the rendered sheets.
 *
 * A preview showing no sheet is not a preview of a document with no pages: it
 * is a preview that has not settled, or one that dropped its plan between the
 * wait and the read. Everything downstream treats an empty page list as
 * vacuously passing, so it is refused here instead.
 */
async function readPlan(page: Page): Promise<PreviewPlan> {
  const plan = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll("[data-page]")];
    const pageKeeps = sheets.map((sheet) =>
      [...sheet.querySelectorAll("[data-keep-id]")]
        .filter((keep) => keep.getAttribute("data-keep-repeat") !== "true")
        .map((keep) => keep.getAttribute("data-keep-id") ?? "")
    );
    const firstKeeps = pageKeeps.map((keeps) => keeps[0] ?? "");
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
    };
  });

  if (plan.pageCount === 0) {
    throw new Error("The preview drew no sheet at all. Nothing measured against it means anything.");
  }
  return plan;
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
    set: DataSet,
    branding: Branding,
    paper: PageDimensions
  ): Promise<PreviewPlan> => {
    await page.bringToFront();
    // The branding is chosen first: it changes the paper, and a plan measured
    // on one paper and captured on another would compare two documents.
    await page.click(`[data-choice="branding"] [data-choice-option="${branding}"]`);
    await page.click(`[data-choice="data-set"] [data-choice-option="${set}"]`);
    // The readout publishes the plan's page count; the sheets are drawn from
    // the same plan. Waiting for the two to agree waits for a settled plan
    // rather than for a fixed delay.
    await page.waitForFunction(
      () => {
        const readout = document.querySelector("[data-page-count]");
        if (readout === null) return false;
        const planned = Number(readout.getAttribute("data-page-count"));
        return planned > 0 && document.querySelectorAll("[data-page]").length === planned;
      },
      // Polled on a timer rather than on animation frames. The suite also holds
      // a rasterizing tab, and a browser that is not showing this one stops
      // producing frames for it, which would leave a frame-polled wait hanging.
      { timeout: 60_000, polling: 100 }
    );
    await assertUnscaled(page, paper);
    return readPlan(page);
  };

  const capture = async (): Promise<PreviewCapture[]> => {
    await page.bringToFront();
    // A tab that is not on top stops receiving frames from the compositor.
    // `bringToFront` makes it the foreground tab again, but that alone does
    // not wait for a frame to be drawn against the current DOM: on a loaded
    // runner the very next screenshot can land before that frame does, and it
    // then captures whatever was on screen before the switch — the lab's own
    // frame around the sheet — rather than the sheet itself. Two ticks rather
    // than one: the first is the frame the switch itself triggers, and the
    // sheet's own paint is scheduled for the one after it.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
    const { pageCount } = await readPlan(page);
    const captures: PreviewCapture[] = [];
    for (let number = 1; number <= pageCount; number++) {
      const sheet = await page.$(`[data-page="${number}"]`);
      if (sheet === null) throw new Error(`the preview has no page ${number}`);
      const png = await sheet.screenshot({ type: "png", encoding: "base64" });
      const one: PreviewCapture = { number, png };
      await assertPainted(page, one);
      captures.push(one);
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
