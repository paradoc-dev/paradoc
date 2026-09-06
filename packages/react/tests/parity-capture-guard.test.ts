/**
 * The blank-capture guard, checked against a stub page.
 *
 * `assertPainted` samples four corners of a capture through `page.evaluate`
 * and refuses one where none of them read paper white. `captureWhenPainted`
 * polls it: it screenshots, samples, and either accepts or waits a beat and
 * tries again, up to a deadline. The real sampling runs in a browser
 * (`Image`, `canvas`), which this suite deliberately does not start, so the
 * stub page returns the corners a real one would have decoded and these tests
 * check only the decisions each function makes from them.
 */

import type { ElementHandle, Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import { assertPainted, captureWhenPainted } from "./parity/preview";

/** A `Page` stub whose `evaluate` hands back canned corner samples. */
function stubPage(corners: ReadonlyArray<readonly [number, number, number]>): Page {
  return { evaluate: vi.fn().mockResolvedValue(corners) } as unknown as Page;
}

/**
 * A `Page` stub for `captureWhenPainted`: one set of corners per attempt,
 * held at the last entry once the sequence runs out. The real page.evaluate
 * is called twice per attempt — once for the paint wait, which takes no
 * extra arguments, and once for `sampleCorners`, which takes the capture and
 * a fraction — so the stub tells them apart by argument count rather than by
 * which function was passed, the way the real one is serialized across into
 * the page and cannot be inspected here either.
 */
function stubPollingPage(
  attempts: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>>
): { page: Page; sheet: ElementHandle<Element> } {
  let attempt = 0;
  const evaluate = vi.fn(async (..._args: unknown[]) => {
    if (_args.length === 1) return undefined; // the requestAnimationFrame wait
    const corners = attempts[Math.min(attempt, attempts.length - 1)];
    attempt += 1;
    return corners;
  });
  const page = { evaluate } as unknown as Page;
  const sheet = {
    screenshot: vi.fn().mockResolvedValue(""),
  } as unknown as ElementHandle<Element>;
  return { page, sheet };
}

describe("assertPainted", () => {
  it("passes a capture whose corners all read paper white", async () => {
    const page = stubPage([
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ]);
    await expect(assertPainted(page, { number: 1, png: "" })).resolves.toBeUndefined();
  });

  it("passes when only some corners are white", async () => {
    // A real page whose margin still carries a faint shadow or logo near one
    // corner should not be mistaken for a capture that painted nothing.
    const page = stubPage([
      [255, 255, 255],
      [40, 40, 40],
      [255, 255, 255],
      [255, 255, 255],
    ]);
    await expect(assertPainted(page, { number: 2, png: "" })).resolves.toBeUndefined();
  });

  it("refuses a capture whose corners all read the lab's grey frame", async () => {
    const page = stubPage([
      [229, 229, 229],
      [229, 229, 229],
      [229, 229, 229],
      [229, 229, 229],
    ]);
    await expect(assertPainted(page, { number: 3, png: "" })).rejects.toThrow(
      /page 3.*not paper white/s
    );
  });

  it("names the page the capture came from", async () => {
    const page = stubPage([
      [243, 243, 243],
      [243, 243, 243],
      [243, 243, 243],
      [243, 243, 243],
    ]);
    await expect(assertPainted(page, { number: 7, png: "" })).rejects.toThrow(/page 7/);
  });
});

describe("captureWhenPainted", () => {
  const GREY: readonly [number, number, number] = [229, 229, 229];
  const WHITE: readonly [number, number, number] = [255, 255, 255];

  it("polls past a sheet that has not painted yet and accepts the first white attempt", async () => {
    const { page, sheet } = stubPollingPage([
      [GREY, GREY, GREY, GREY],
      [GREY, GREY, GREY, GREY],
      [WHITE, WHITE, WHITE, WHITE],
    ]);
    const capture = await captureWhenPainted(page, sheet, 4);
    expect(capture).toEqual({ number: 4, png: "" });
    // One screenshot per attempt: two discarded as not yet painted, the
    // third accepted.
    expect(sheet.screenshot).toHaveBeenCalledTimes(3);
  });

  it("throws the blank-capture error, naming the page and the last reading, once the deadline passes", async () => {
    const { page, sheet } = stubPollingPage([[GREY, GREY, GREY, GREY]]);
    await expect(captureWhenPainted(page, sheet, 2, 250)).rejects.toThrow(
      /page 2: every sampled corner reads \[229,229,229\].*not paper white/s
    );
  });
});
