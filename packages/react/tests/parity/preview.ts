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
 * full sheet, and the sheet's measured width is asserted rather than assumed.
 */

import type { Browser, Page } from "puppeteer";

import { PAPER_HEIGHT_PX, PAPER_WIDTH_PX } from "../../src/components/paper";

/** Which sample document the lab is showing. */
export type DataSet = "short" | "overflow";

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
  /** Shows `set` and waits until its pages are drawn. */
  show: (set: DataSet) => Promise<PreviewPlan>;
  /** One image per drawn page. */
  capture: () => Promise<PreviewCapture[]>;
  /** Adds a stylesheet to the preview, for the run that proves the suite can fail. */
  restyle: (css: string) => Promise<void>;
}

/** Reads the plan off the rendered sheets. */
async function readPlan(page: Page): Promise<PreviewPlan> {
  return page.evaluate(() => {
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
}

/** Fails unless every sheet is exactly one sheet of paper on screen. */
async function assertUnscaled(page: Page): Promise<void> {
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll("[data-page]")].map((sheet) => {
      const box = sheet.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    })
  );
  const wrong = sizes.filter(
    (size) => size.width !== PAPER_WIDTH_PX || size.height !== PAPER_HEIGHT_PX
  );
  if (wrong.length > 0) {
    throw new Error(
      `The preview is scaled: sheets measured ${JSON.stringify(wrong)} rather than ` +
        `${PAPER_WIDTH_PX}x${PAPER_HEIGHT_PX}. Widen the window the suite opens.`
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

  const show = async (set: DataSet): Promise<PreviewPlan> => {
    await page.bringToFront();
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
    await assertUnscaled(page);
    return readPlan(page);
  };

  const capture = async (): Promise<PreviewCapture[]> => {
    await page.bringToFront();
    const { pageCount } = await readPlan(page);
    const captures: PreviewCapture[] = [];
    for (let number = 1; number <= pageCount; number++) {
      const sheet = await page.$(`[data-page="${number}"]`);
      if (sheet === null) throw new Error(`the preview has no page ${number}`);
      const png = await sheet.screenshot({ type: "png", encoding: "base64" });
      captures.push({ number, png });
    }
    return captures;
  };

  const restyle = async (css: string): Promise<void> => {
    await page.bringToFront();
    await page.addStyleTag({ content: css });
    // A repaint, not a repagination: the caller's rule must not move a keep,
    // or the comparison would be against a different document.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
    await assertUnscaled(page);
  };

  return { page, show, capture, restyle };
}
