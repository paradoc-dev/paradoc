/**
 * The allow-list, checked against the engine rather than against a document.
 *
 * `src/pdf/tailwind.ts` claims the engine honours every family it admits. This
 * proves it: each family's representative class is rendered into a fragment
 * with and without, and the PDF bytes have to differ. A family the engine stops
 * honouring — a version bump, a build change — fails here instead of quietly
 * flattening a document.
 *
 * The reverse also has to hold, so the classes admitted because their value is
 * the one the engine already applies are asserted byte-identical. Those are the
 * only entries allowed to have no effect, and if one ever gains an effect the
 * assumption behind admitting it was wrong.
 */

import type { ReactNode } from "react";
import { render } from "takumi-pdf";
import { describe, expect, it } from "vitest";
import { PDF_RESET_STYLESHEET } from "../src/pdf/reset";
import {
  INITIAL_VALUE_CLASSES,
  isSupportedClass,
  SUPPORTED_CLASS_FAMILIES,
  type ProbeHarness,
} from "../src/pdf/tailwind";

/**
 * A wide row inside a fixed column, painted so its box geometry is drawn, with
 * two children of different sizes so cross-axis alignment is visible.
 */
const layout = (tw: string): ReactNode => (
  <div tw="flex flex-col" style={{ width: 600, height: 400 }}>
    <div tw={`flex border bg-neutral-200 ${tw}`}>
      <span tw="text-xs bg-white">Alpha bravo charlie delta echo foxtrot golf hotel india</span>
      <span tw="text-2xl bg-neutral-400">Juliet</span>
    </div>
    <div tw="flex grow">
      <span tw="text-sm">filler</span>
    </div>
  </div>
);

/** The same row too narrow for its children, where wrapping and gaps show. */
const narrow = (tw: string): ReactNode => (
  <div tw="flex flex-col" style={{ width: 200, height: 400 }}>
    <div tw={`flex border bg-neutral-200 ${tw}`}>
      <span tw="text-xs bg-white">Alpha bravo charlie</span>
      <span tw="text-xs bg-neutral-400">Delta echo foxtrot</span>
    </div>
    <div tw="flex grow">
      <span tw="text-sm">filler</span>
    </div>
  </div>
);

/** A keep of wrapping text with a hard newline in it. */
const text = (tw: string): ReactNode => (
  <div tw="flex flex-col" style={{ width: 300 }}>
    <div tw={`flex ${tw}`}>
      <span>{"Alpha bravo charlie delta echo foxtrot golf\nsecond line"}</span>
    </div>
  </div>
);

/**
 * The same text, with the class on the text-bearing `span` itself rather than
 * on a flex ancestor. The two are not interchangeable: takumi does not
 * propagate every text-level property down through a flex container to the
 * text inside it, `text-decoration` among them (found when the 2026-09
 * re-probe first tried `text` for `underline` and got a false negative — see
 * the module doc in `src/pdf/tailwind.ts`). A property that acts on the text
 * itself needs `inline`, not `text`.
 */
const inline = (tw: string): ReactNode => (
  <div tw="flex flex-col" style={{ width: 300 }}>
    <span tw={tw}>{"Alpha bravo charlie delta echo foxtrot golf\nsecond line"}</span>
  </div>
);

/**
 * A page stamp: a line of large text centred on a layer, with the class on the
 * text itself, which is where a watermark's rotation goes.
 */
const stamp = (tw: string): ReactNode => (
  <div tw="flex items-center justify-center" style={{ width: 600, height: 400 }}>
    <span tw={`text-6xl text-neutral-300 ${tw}`}>DRAFT</span>
  </div>
);

const HARNESSES: Record<ProbeHarness, (tw: string) => ReactNode> = {
  layout,
  narrow,
  text,
  inline,
  stamp,
};

async function bytes(element: ReactNode): Promise<Buffer> {
  return Buffer.from(
    await render(element, {
      size: "letter",
      margin: 24,
      fonts: [],
      fontFamilies: ["sans-serif"],
      stylesheets: [PDF_RESET_STYLESHEET],
    })
  );
}

const baselines = new Map<ProbeHarness, Promise<Buffer>>();

function baseline(harness: ProbeHarness): Promise<Buffer> {
  const cached = baselines.get(harness);
  if (cached) return cached;
  const pending = bytes(HARNESSES[harness](""));
  baselines.set(harness, pending);
  return pending;
}

describe("every allow-listed family changes the PDF", () => {
  it.each(SUPPORTED_CLASS_FAMILIES.map((family) => [family.name, family] as const))(
    "%s",
    async (_name, family) => {
      const [base, probed] = await Promise.all([
        baseline(family.harness),
        bytes(HARNESSES[family.harness](family.probe)),
      ]);
      expect(
        probed.equals(base),
        `"${family.probe}" changed nothing, so the engine does not honour the ${family.name} family`
      ).toBe(false);
    },
    60_000
  );
});

describe("every class admitted as an engine default really is one", () => {
  it.each(INITIAL_VALUE_CLASSES)("%s", async (name) => {
    expect(isSupportedClass(name), `${name} is not covered by any family`).toBe(true);
    const [base, probed] = await Promise.all([baseline("layout"), bytes(layout(name))]);
    expect(
      probed.equals(base),
      `"${name}" changed the output, so it is not the value the engine already applies`
    ).toBe(true);
  }, 60_000);
});

it("no-underline is supported and cancels underline without a visible effect on its own", async () => {
  expect(isSupportedClass("no-underline")).toBe(true);
  const [base, probed, sensitivityControl] = await Promise.all([
    bytes(inline("")),
    bytes(inline("no-underline")),
    // The harness itself has to be capable of showing a decoration change, or
    // "no-underline changed nothing" proves nothing about no-underline.
    bytes(inline("underline")),
  ]);
  expect(probed.equals(base), '"no-underline" changed a page with no underline to remove').toBe(true);
  expect(
    sensitivityControl.equals(base),
    "the inline harness did not register underline either, so it cannot show no-underline's absence of effect"
  ).toBe(false);
}, 60_000);

/**
 * A run of inline text with a nested span, so vertical-align has a line box to
 * act inside and a sibling run to be measured against. `inline` above applies
 * the whole class to the only content on its line, which is enough to reveal
 * `text-decoration` but not reliably `vertical-align`: probed the same way,
 * `align-super` came back byte-identical on Chromium too, a false negative
 * from having nothing on the line for the shifted box to be measured against.
 * `align-sub` did not, which is exactly the unreliability that ruled `inline`
 * out for this family and kept `supersub` a separate harness.
 */
const supersub = (className: string): ReactNode => (
  <div tw="flex flex-col" style={{ width: 300 }}>
    <span>
      {"Value E=mc"}
      <span tw={className}>{"2"}</span>
      {" continues after"}
    </span>
  </div>
);

/**
 * Re-probes the classes the module doc names as excluded, against the current
 * takumi-pdf version, so a version bump that starts honouring one of them is
 * caught here rather than by someone reading the comment. Each byte-identical
 * assertion is paired with `isSupportedClass` and a sensitivity control — a
 * class known to change bytes in the same harness — because a byte-identical
 * result proves an exclusion only if the harness can tell the difference at
 * all; the `text-decoration` family exists because the original probe skipped
 * that control. See `pdf-class-support-chromium.test.tsx` for the same
 * classes against the Chromium adapter, which renders every one of them: the
 * engine, not the class, is what is unsupported.
 */
describe("classes the specification asked to re-probe, still excluded on takumi", () => {
  it.each([
    ["border-dashed", layout, "border-4"],
    ["border-dotted", layout, "border-4"],
  ] as const)("%s stays byte-identical", async (name, harness, control) => {
    expect(isSupportedClass(name), `${name} should not be covered by any family`).toBe(false);
    const [base, probed, sensitivityControl] = await Promise.all([
      bytes(harness("")),
      bytes(harness(name)),
      bytes(harness(control)),
    ]);
    expect(
      probed.equals(base),
      `"${name}" changed the output; takumi-pdf may now honour it — update tailwind.ts and safe-classes.md`
    ).toBe(true);
    expect(
      sensitivityControl.equals(base),
      `the "${harness.name}" harness did not register "${control}" either, so it cannot show "${name}"'s absence of effect`
    ).toBe(false);
  }, 60_000);

  it.each(["align-super", "align-sub"] as const)("%s stays byte-identical", async (name) => {
    expect(isSupportedClass(name), `${name} should not be covered by any family`).toBe(false);
    const [base, probed, sensitivityControl] = await Promise.all([
      bytes(supersub("")),
      bytes(supersub(name)),
      // `text-2xl` on the same nested span, known to move the bytes: proof
      // the harness can register a change in the superscript span itself.
      bytes(supersub("text-2xl")),
    ]);
    expect(
      probed.equals(base),
      `"${name}" changed the output; takumi-pdf may now honour vertical-align — update tailwind.ts and safe-classes.md`
    ).toBe(true);
    expect(
      sensitivityControl.equals(base),
      "the supersub harness did not register text-2xl either, so it cannot show vertical-align's absence of effect"
    ).toBe(false);
  }, 60_000);
});

/**
 * The family probe shows `-rotate-45` changes the page. A stamp turned the
 * other way has to change it differently, or the engine is drawing one fixed
 * turn for any rotation and the class would be a silent loss in one direction.
 */
describe("rotation, probed as a stamp", () => {
  it("draws rotate-45 and -rotate-45 as two different pages", async () => {
    const [clockwise, anticlockwise] = await Promise.all([
      bytes(stamp("rotate-45")),
      bytes(stamp("-rotate-45")),
    ]);
    expect(clockwise.equals(anticlockwise)).toBe(false);
  }, 60_000);
});
