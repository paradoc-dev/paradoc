/**
 * The same re-probed classes as `pdf-class-support.test.tsx`, against the
 * Chromium adapter — in the same harness shapes, so the two suites cannot
 * drift into comparing different fragments the way `underline`'s first
 * takumi re-probe did (see that file's module doc).
 *
 * The specification asked for the excluded classes to be checked against
 * both engines, not just takumi: a class either engine ignores stays
 * excluded, and a class only takumi ignores is worth knowing about, because it
 * says the gap is the engine and not the class. Chromium is a real browser
 * printing real compiled Tailwind CSS, so every one of these renders here —
 * that is the point of the comparison, not a surprise. `underline` and
 * `line-through` are admitted by this change; the rest stay excluded on
 * takumi and are checked here only to confirm Chromium is not the reason.
 *
 * It needs a Chrome, and — like `pdf-chromium.test.tsx` — it does not decide
 * for itself whether to run: a machine with no browser fails loudly rather
 * than silently covering nothing. Set `PARADOC_SKIP_CHROMIUM_TESTS=1` to opt
 * out deliberately.
 */

import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderPdf } from "../src";
import { chromiumExecutable, closeChromium } from "../src/adapters/chromium";

const skipped = process.env.PARADOC_SKIP_CHROMIUM_TESTS === "1";
if (skipped) {
  console.log("Skipping the Chromium class re-probe: PARADOC_SKIP_CHROMIUM_TESTS=1.");
}

/**
 * `className`, not `tw`: this goes through `renderPdf`'s real element tree,
 * which the Chromium adapter serialises with `react-dom`'s
 * `renderToStaticMarkup`. `tw` is a takumi-only convention the tree walk
 * translates into a class before takumi ever sees it (`tree.ts`); react-dom
 * knows nothing about it and would emit it as a literal, inert attribute. A
 * real composition always authors `className`, so this is also the more
 * representative harness. The class sits on the text-bearing `span` itself —
 * the same shape as takumi's `inline` harness, and for the same reason:
 * `text-decoration` does not reach here from a class on a flex ancestor.
 */
const inline = (className: string): ReactNode => (
  <div className="flex flex-col" style={{ width: 300 }}>
    <span className={className}>{"Alpha bravo charlie delta echo foxtrot golf\nsecond line"}</span>
  </div>
);

const supersub = (className: string): ReactNode => (
  <div className="flex flex-col" style={{ width: 300 }}>
    <span>
      {"Value E=mc"}
      <span className={className}>{"2"}</span>
      {" continues after"}
    </span>
  </div>
);

const layout = (className: string): ReactNode => (
  <div className="flex flex-col" style={{ width: 600, height: 400 }}>
    <div className={`flex border bg-neutral-200 ${className}`}>
      <span className="text-xs bg-white">Alpha bravo charlie delta echo foxtrot golf hotel india</span>
      <span className="text-2xl bg-neutral-400">Juliet</span>
    </div>
    <div className="flex grow">
      <span className="text-sm">filler</span>
    </div>
  </div>
);

/** A page stamp: a line of large text centred on a layer, the class on the text. */
const stamp = (className: string): ReactNode => (
  <div className="flex items-center justify-center" style={{ width: 600, height: 400 }}>
    <span className={`text-6xl text-neutral-300 ${className}`}>DRAFT</span>
  </div>
);

async function bytes(element: ReactNode): Promise<Buffer> {
  const { bytes: rendered } = await renderPdf(element, { adapter: "chromium" });
  return Buffer.from(rendered);
}

describe.skipIf(skipped)("the re-probed classes against the Chromium adapter", () => {
  beforeAll(async () => {
    const executable = await chromiumExecutable();
    if (executable === undefined) {
      throw new Error(
        "The Chromium class re-probe needs a Chrome. None of the well-known install paths " +
          "exists: set PUPPETEER_EXECUTABLE_PATH to one, or set " +
          "PARADOC_SKIP_CHROMIUM_TESTS=1 to opt out of this file deliberately."
      );
    }
  });

  afterAll(async () => {
    await closeChromium();
  });

  it.each(["underline", "line-through"] as const)("%s changes the PDF, and is admitted", async (name) => {
    const [base, probed] = await Promise.all([bytes(inline("")), bytes(inline(name))]);
    expect(probed.equals(base)).toBe(false);
  }, 120_000);

  it("no-underline changes nothing, because there is no underline to remove", async () => {
    const [base, probed] = await Promise.all([bytes(inline("")), bytes(inline("no-underline"))]);
    expect(probed.equals(base)).toBe(true);
  }, 120_000);

  // `layout`, not `inline`: a border *style* has nothing to draw without
  // the `border` width the family already applies, which `layout` carries and
  // the plain text fragment does not.
  it.each(["border-dashed", "border-dotted"] as const)("%s changes the PDF, but stays excluded", async (name) => {
    const [base, probed] = await Promise.all([bytes(layout("")), bytes(layout(name))]);
    expect(probed.equals(base)).toBe(false);
  }, 120_000);

  it.each(["align-super", "align-sub"] as const)("%s changes the PDF, but stays excluded", async (name) => {
    const [base, probed] = await Promise.all([bytes(supersub("")), bytes(supersub(name))]);
    expect(probed.equals(base)).toBe(false);
  }, 120_000);

  // Rotation is admitted for the page stamp, so it is probed here in the
  // stamp's own shape, as it is on takumi: large text centred on a layer.
  it.each(["-rotate-45", "rotate-45"] as const)("%s changes the PDF, and is admitted", async (name) => {
    const [base, probed] = await Promise.all([bytes(stamp("")), bytes(stamp(name))]);
    expect(probed.equals(base)).toBe(false);
  }, 120_000);
});
