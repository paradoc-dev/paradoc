/**
 * The blank-capture guard, checked against a stub page.
 *
 * `assertPainted` samples four corners of a capture through `page.evaluate`
 * and refuses one where none of them read paper white. The real sampling runs
 * in a browser (`Image`, `canvas`), which this suite deliberately does not
 * start, so the stub page returns the corners a real one would have decoded
 * and this test checks only the decision `assertPainted` makes from them.
 */

import type { Page } from "puppeteer";
import { describe, expect, it, vi } from "vitest";
import { assertPainted } from "./parity/preview";

/** A `Page` stub whose `evaluate` hands back canned corner samples. */
function stubPage(corners: ReadonlyArray<readonly [number, number, number]>): Page {
  return { evaluate: vi.fn().mockResolvedValue(corners) } as unknown as Page;
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
