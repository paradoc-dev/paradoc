import { describe, expect, it } from "vitest";

import { isSupportedClass } from "../src/pdf/tailwind";
import {
  DEFAULT_DOCUMENT_TOKENS,
  InvalidDocumentTokenError,
  disagreeingRootToken,
  resolveDocumentTokens,
  sameDocumentTokens,
} from "../src/lib/tokens";
import {
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_LEVELS,
  flowGapClasses,
  scaleTextClasses,
} from "../src/lib/typography";

const LABEL = "text-xs font-medium uppercase tracking-wide text-neutral-500";
const ROOT = "flex flex-col gap-6 text-sm leading-relaxed text-neutral-900";
const TOTAL = "flex w-full justify-between border-t pt-1 text-base font-semibold";

describe("scaleTextClasses", () => {
  it("leaves the classes alone at regular, so a document that names no rhythm is unchanged", () => {
    expect(scaleTextClasses(ROOT, "regular")).toBe(ROOT);
    expect(scaleTextClasses(LABEL, "regular")).toBe(LABEL);
  });

  it("steps every size and leading one place, and touches nothing else", () => {
    expect(scaleTextClasses(ROOT, "compact")).toBe(
      "flex flex-col gap-6 text-xs leading-snug text-neutral-900"
    );
    expect(scaleTextClasses(ROOT, "roomy")).toBe(
      "flex flex-col gap-6 text-base leading-loose text-neutral-900"
    );
    expect(scaleTextClasses(TOTAL, "compact")).toBe(
      "flex w-full justify-between border-t pt-1 text-sm font-semibold"
    );
    expect(scaleTextClasses(TOTAL, "roomy")).toBe(
      "flex w-full justify-between border-t pt-1 text-lg font-semibold"
    );
  });

  it("floors at the smallest verified size, so a compact label stays a label", () => {
    expect(scaleTextClasses(LABEL, "compact")).toBe(LABEL);
    expect(scaleTextClasses(LABEL, "roomy")).toBe(
      "text-sm font-medium uppercase tracking-wide text-neutral-500"
    );
  });

  it("does not mistake a colour or an alignment for a size", () => {
    expect(scaleTextClasses("text-neutral-700 text-right text-balance", "roomy")).toBe(
      "text-neutral-700 text-right text-balance"
    );
  });

  it("steps every verified size and leading form, to the ends of each scale", () => {
    expect(scaleTextClasses("text-9xl", "roomy")).toBe("text-9xl");
    expect(scaleTextClasses("text-8xl", "roomy")).toBe("text-9xl");
    expect(scaleTextClasses("leading-none", "compact")).toBe("leading-none");
    expect(scaleTextClasses("leading-tight", "compact")).toBe("leading-none");
    expect(scaleTextClasses("leading-6", "compact")).toBe("leading-5");
    expect(scaleTextClasses("leading-6", "roomy")).toBe("leading-7");
    expect(scaleTextClasses("leading-0.5", "compact")).toBe("leading-0");
  });
});

describe("flowGapClasses", () => {
  it("moves the gap two spacing units per step and floors at zero", () => {
    expect(flowGapClasses(ROOT, "regular")).toBe(ROOT);
    expect(flowGapClasses(ROOT, "compact")).toBe(
      "flex flex-col gap-4 text-sm leading-relaxed text-neutral-900"
    );
    expect(flowGapClasses(ROOT, "roomy")).toBe(
      "flex flex-col gap-8 text-sm leading-relaxed text-neutral-900"
    );
    expect(flowGapClasses("flex gap-1", "compact")).toBe("flex gap-0");
  });

  it("steps half gaps, axis gaps, and the ceiling, and leaves gap-px alone", () => {
    expect(flowGapClasses("gap-0.5", "compact")).toBe("gap-0");
    expect(flowGapClasses("gap-0.5", "roomy")).toBe("gap-2.5");
    expect(flowGapClasses("gap-x-4 gap-y-2", "roomy")).toBe("gap-x-6 gap-y-4");
    expect(flowGapClasses("gap-999", "roomy")).toBe("gap-999.5");
    expect(flowGapClasses("gap-px", "roomy")).toBe("gap-px");
  });
});

describe("every class a level can produce", () => {
  const roles = [
    ROOT,
    LABEL,
    TOTAL,
    "text-xs",
    "text-9xl leading-none",
    "leading-loose leading-6 leading-0.5",
    "gap-0 gap-0.5 gap-999 gap-x-2 gap-y-13 gap-px",
  ];

  it("is one the default PDF engine has verified", () => {
    for (const scale of TYPOGRAPHY_LEVELS) {
      for (const flow of TYPOGRAPHY_LEVELS) {
        for (const role of roles) {
          const produced = flowGapClasses(scaleTextClasses(role, scale), flow);
          for (const name of produced.split(" ")) {
            expect(isSupportedClass(name), `${name} from ${role} at ${scale}/${flow}`).toBe(true);
          }
        }
      }
    }
  });
});

describe("the typography token", () => {
  it("defaults to today's document", () => {
    expect(DEFAULT_DOCUMENT_TOKENS.typography).toEqual(DEFAULT_TYPOGRAPHY);
    expect(resolveDocumentTokens().typography).toEqual({ scale: "regular", flow: "regular" });
  });

  it("lets either knob be named alone and keeps the other", () => {
    expect(resolveDocumentTokens({ typography: { scale: "compact" } }).typography).toEqual({
      scale: "compact",
      flow: "regular",
    });
    expect(resolveDocumentTokens({ typography: { flow: "roomy" } }).typography).toEqual({
      scale: "regular",
      flow: "roomy",
    });
  });

  it("layers knob by knob, so a later layer that names only flow keeps the scale", () => {
    const tokens = resolveDocumentTokens(
      { typography: { scale: "compact" } },
      { typography: { flow: "roomy" } }
    );
    expect(tokens.typography).toEqual({ scale: "compact", flow: "roomy" });
  });

  it("refuses a level it does not know, naming the knob", () => {
    expect(() =>
      resolveDocumentTokens({ typography: { scale: "dense" as never } })
    ).toThrowError(InvalidDocumentTokenError);
    expect(() =>
      resolveDocumentTokens({ typography: { scale: "dense" as never } })
    ).toThrowError(/typography\.scale/);
  });

  it("refuses a knob it does not know, rather than dropping it", () => {
    expect(() =>
      resolveDocumentTokens({ typography: { scael: "compact" } as never })
    ).toThrowError(/"scael", which is not a knob/);
  });

  it("compares by value, so two resolutions of the same rhythm agree", () => {
    const a = resolveDocumentTokens({ typography: { scale: "roomy" } });
    const b = resolveDocumentTokens({ typography: { scale: "roomy", flow: "regular" } });
    expect(sameDocumentTokens(a, b)).toBe(true);
    expect(disagreeingRootToken(a, b)).toBeUndefined();
    const c = resolveDocumentTokens({ typography: { flow: "compact" } });
    expect(disagreeingRootToken(a, c)).toBe("typography");
  });
});
