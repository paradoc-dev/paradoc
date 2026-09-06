/**
 * The capture guards, checked against a stub page.
 *
 * `assertPainted` reads a capture back through `page.evaluate` and refuses it
 * on either of two counts: none of its four corner samples is paper white, so
 * nothing painted; or a point on its own border is not the sheet's blank
 * margin, so the clip did not sit on the sheet and the whole document in the
 * capture is offset. `captureWhenPainted` polls both: it places the sheet,
 * screenshots, reads it back, and either accepts or waits a beat and tries
 * again, up to a deadline. The real reading runs in a browser (`Image`,
 * `canvas`), which this suite deliberately does not start, so the stub page
 * returns the samples a real one would have decoded and these tests check only
 * the decisions each function makes from them.
 */

import type { ElementHandle, Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import { assertPainted, captureWhenPainted, type CaptureSample } from "./parity/preview";

type Point = readonly [number, number, number];

const WHITE: Point = [255, 255, 255];
const GREY: Point = [229, 229, 229];

/**
 * A border reading as the sheet's own blank margin all the way round: five
 * points across each of the four edges, at three depths each.
 */
function paperBorder(): Point[] {
  return Array.from({ length: 5 * 3 * 4 }, () => WHITE);
}

/** A border with the lab's frame along one edge, which is what an overhanging clip reads as. */
function overhangingBorder(): Point[] {
  const border = paperBorder();
  // Every fourth point is one of the capture's top rows: the edge a clip that
  // sat above the sheet overhangs onto.
  for (let index = 0; index < border.length; index += 4) border[index] = GREY;
  return border;
}

/** A `Page` stub whose `evaluate` hands back one canned reading. */
function stubPage(sample: CaptureSample): Page {
  return { evaluate: vi.fn().mockResolvedValue(sample) } as unknown as Page;
}

/**
 * A `Page` and sheet stub for `captureWhenPainted`: one reading per attempt,
 * held at the last entry once the sequence runs out. The real `page.evaluate`
 * is called with one argument for the frame wait and with three for the
 * capture reading, so the stub tells them apart by argument count rather than
 * by which function was passed, the way the real one is serialized across into
 * the page and cannot be inspected here either. The sheet's own `evaluate` is
 * the scroll that places it, which returns nothing.
 */
function stubPollingPage(attempts: readonly CaptureSample[]): {
  page: Page;
  sheet: ElementHandle<Element>;
} {
  let attempt = 0;
  const evaluate = vi.fn(async (...args: unknown[]) => {
    if (args.length === 1) return undefined; // the requestAnimationFrame wait
    const sample = attempts[Math.min(attempt, attempts.length - 1)];
    attempt += 1;
    return sample;
  });
  const page = { evaluate } as unknown as Page;
  const sheet = {
    evaluate: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(""),
  } as unknown as ElementHandle<Element>;
  return { page, sheet };
}

describe("assertPainted", () => {
  it("passes a capture whose corners all read paper white", async () => {
    const page = stubPage({ corners: [WHITE, WHITE, WHITE, WHITE], border: paperBorder() });
    await expect(assertPainted(page, { number: 1, png: "" })).resolves.toBeUndefined();
  });

  it("passes when only some corners are white", async () => {
    // A real page whose margin still carries a faint shadow or logo near one
    // corner should not be mistaken for a capture that painted nothing.
    const page = stubPage({
      corners: [WHITE, [40, 40, 40], WHITE, WHITE],
      border: paperBorder(),
    });
    await expect(assertPainted(page, { number: 2, png: "" })).resolves.toBeUndefined();
  });

  it("refuses a capture whose corners all read the lab's grey frame", async () => {
    const page = stubPage({ corners: [GREY, GREY, GREY, GREY], border: paperBorder() });
    await expect(assertPainted(page, { number: 3, png: "" })).rejects.toThrow(
      /page 3.*not paper white/s
    );
  });

  it("names the page the capture came from", async () => {
    const grey: Point = [243, 243, 243];
    const page = stubPage({ corners: [grey, grey, grey, grey], border: paperBorder() });
    await expect(assertPainted(page, { number: 7, png: "" })).rejects.toThrow(/page 7/);
  });

  it("refuses a capture whose clip overhung the sheet, corners and all", async () => {
    // The branded variant's page 1 on a loaded runner. `ElementHandle.screenshot`
    // scrolls a sheet the viewport cannot hold into view and clips at where the
    // scroll left it, and the capture comes back from the frame before that
    // scroll painted: a band of the lab's grey along the top edge and the whole
    // document that many pixels low. The corner samples are 3 percent in and
    // read paper white throughout, which is exactly why this capture used to be
    // accepted and measured — 7.73 percent ink against the 6.31 percent the
    // same page measures when the clip is on the sheet.
    const page = stubPage({
      corners: [WHITE, WHITE, WHITE, WHITE],
      border: overhangingBorder(),
    });
    await expect(assertPainted(page, { number: 1, png: "" })).rejects.toThrow(
      /page 1.*border reads \[229,229,229\].*did not sit on the sheet/s
    );
  });
});

describe("captureWhenPainted", () => {
  const blank: CaptureSample = { corners: [GREY, GREY, GREY, GREY], border: paperBorder() };
  const offset: CaptureSample = {
    corners: [WHITE, WHITE, WHITE, WHITE],
    border: overhangingBorder(),
  };
  const good: CaptureSample = { corners: [WHITE, WHITE, WHITE, WHITE], border: paperBorder() };

  it("polls past a sheet that has not painted yet and accepts the first white attempt", async () => {
    const { page, sheet } = stubPollingPage([blank, blank, good]);
    const capture = await captureWhenPainted(page, sheet, 4);
    expect(capture).toEqual({ number: 4, png: "" });
    // One screenshot per attempt: two discarded as not yet painted, the
    // third accepted.
    expect(sheet.screenshot).toHaveBeenCalledTimes(3);
  });

  it("places the sheet itself and tells the screenshot not to scroll", async () => {
    // The scroll and the frame that paints it are not the same event. Leaving
    // the scroll to the screenshot is what let a capture be clipped where the
    // sheet now is and taken from where it was.
    const { page, sheet } = stubPollingPage([good]);
    await captureWhenPainted(page, sheet, 1);
    expect(sheet.evaluate).toHaveBeenCalledTimes(1);
    expect(sheet.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ scrollIntoView: false })
    );
  });

  it("polls past a capture whose clip overhung the sheet", async () => {
    const { page, sheet } = stubPollingPage([offset, good]);
    const capture = await captureWhenPainted(page, sheet, 1);
    expect(capture).toEqual({ number: 1, png: "" });
    expect(sheet.screenshot).toHaveBeenCalledTimes(2);
  });

  it("throws the blank-capture error, naming the page and the last reading, once the deadline passes", async () => {
    const { page, sheet } = stubPollingPage([blank]);
    await expect(captureWhenPainted(page, sheet, 2, 250)).rejects.toThrow(
      /page 2: every sampled corner reads \[229,229,229\].*not paper white/s
    );
  });

  it("throws the overhanging-clip error once the deadline passes", async () => {
    const { page, sheet } = stubPollingPage([offset]);
    await expect(captureWhenPainted(page, sheet, 1, 250)).rejects.toThrow(
      /page 1.*did not sit on the sheet/s
    );
  });
});
