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

const HARNESSES: Record<ProbeHarness, (tw: string) => ReactNode> = { layout, narrow, text };

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
