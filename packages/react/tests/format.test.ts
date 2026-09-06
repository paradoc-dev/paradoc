/**
 * The line between a document mid-fill and a document with a bug in it.
 *
 * Getting it wrong in either direction is a real cost. Too strict and no
 * document can be shown while it is being answered; too loose and a rate stored
 * as a string prints as an em dash and nobody finds out until they read the
 * paper. The second cost is the worse one, so the line is drawn twice: partial
 * mode is off unless a caller asks for it, and even with it on a value that is
 * wrong rather than unfinished still throws.
 *
 * `hasUnsuppliedMember` is the structural half and is deliberately generous.
 * `isInProgress` is the decision, and it asks the serializer a second question
 * rather than reading the message of the first refusal.
 */

import { describe, expect, it } from "vitest";
import { REGION_REGISTRIES } from "@paradoc/serialization";

import {
  createValueFormatter,
  formatByType,
  hasUnsuppliedMember,
  InvalidFieldValueError,
  isInProgress,
} from "../src/lib/format";

const serializers = REGION_REGISTRIES.us;

/** What `isInProgress` is asked after a real refusal, with the real refusal. */
function decide(type: string, value: unknown): boolean | "accepted" {
  try {
    serializers[type as "money"].stringify(value as never);
    return "accepted";
  } catch (rejection) {
    return isInProgress(type, value, serializers, rejection);
  }
}

describe("hasUnsuppliedMember", () => {
  it("is true for the blank primitives", () => {
    expect(hasUnsuppliedMember(null)).toBe(true);
    expect(hasUnsuppliedMember(undefined)).toBe(true);
    expect(hasUnsuppliedMember("")).toBe(true);
  });

  it("is false for a real primitive", () => {
    expect(hasUnsuppliedMember(0)).toBe(false);
    expect(hasUnsuppliedMember("Ada Lovelace")).toBe(false);
    expect(hasUnsuppliedMember(false)).toBe(false);
  });

  it("is true for a plain object whose every member is blank", () => {
    expect(hasUnsuppliedMember({ amount: null, currency: null })).toBe(true);
    expect(hasUnsuppliedMember({ amount: null, currency: { code: null } })).toBe(true);
  });

  it("is true for a plain object carrying one blank member", () => {
    // The state a money def is in once the currency has been answered and the
    // amount has not. Half a value is not a value.
    expect(hasUnsuppliedMember({ amount: null, currency: "USD" })).toBe(true);
    expect(hasUnsuppliedMember({ line1: "88 Wharf Road", locality: undefined })).toBe(true);
  });

  it("is false for a plain object every member of which is supplied", () => {
    expect(hasUnsuppliedMember({ amount: 12, currency: "USD" })).toBe(false);
    // Supplied and wrong is still supplied: this is the case that must throw.
    expect(hasUnsuppliedMember({ amount: "12", currency: "USD" })).toBe(false);
  });

  it("is true for an empty array and for an array with a blank in it", () => {
    expect(hasUnsuppliedMember([])).toBe(true);
    expect(hasUnsuppliedMember([null, undefined, ""])).toBe(true);
    expect(hasUnsuppliedMember(["Ada", null])).toBe(true);
  });

  it("is false for an array whose every entry is supplied", () => {
    expect(hasUnsuppliedMember(["Ada", "Grace"])).toBe(false);
  });

  it("is false for a Date, however empty Object.values reports it", () => {
    // A `Date`'s state is not in its own enumerable properties, so
    // `Object.values(new Date())` is `[]` — a plain object with no members
    // reads as unsupplied, which is exactly the false positive this guards
    // against.
    expect(Object.values(new Date())).toEqual([]);
    expect(hasUnsuppliedMember(new Date())).toBe(false);
  });

  it("is false for other non-plain objects: RegExp, Map, a class instance", () => {
    expect(hasUnsuppliedMember(/x/)).toBe(false);
    expect(hasUnsuppliedMember(new Map([["a", 1]]))).toBe(false);

    class Money {
      amount = 0;
    }
    expect(hasUnsuppliedMember(new Money())).toBe(false);
  });

  it("is true for Object.create(null), a plain object with nothing in it", () => {
    expect(hasUnsuppliedMember(Object.create(null))).toBe(true);
  });
});

describe("isInProgress", () => {
  it("is true for a money whose amount has not been answered", () => {
    expect(decide("money", { amount: null, currency: "USD" })).toBe(true);
  });

  it("is true for a money nothing has been answered on", () => {
    expect(decide("money", { amount: null, currency: null })).toBe(true);
  });

  it("is false for a money that is complete and wrong", () => {
    expect(decide("money", { amount: "12", currency: "USD" })).toBe(false);
  });

  it("is false for a money that is wrong AND half-supplied", () => {
    // The case a `some`-shaped rule swallows: one blank member is enough to
    // call the whole value unfinished, and the string amount stops being
    // reported anywhere. Pruning the blank leaves the same refusal, so the
    // refusal was never about the blank.
    expect(decide("money", { amount: "12", currency: null })).toBe(false);
  });

  it("is false for a scalar that is simply the wrong type", () => {
    expect(decide("percentage", "eight")).toBe(false);
  });

  it("is true for a composite with nothing supplied in it at all", () => {
    expect(decide("money", {})).toBe(true);
  });
});

const money = { type: "money", label: "Total", required: false, visible: true } as const;
const percentage = { type: "percentage", label: "Rate", required: false, visible: true } as const;

describe("the default formatter, which is not partial", () => {
  const { format, blank } = createValueFormatter();

  it("throws for a money whose amount has not landed", () => {
    // A finished document with a hole in it is a bug. Only a caller that knows
    // it is showing a fill in progress may ask for the em dash.
    expect(() => format(money, { amount: null, currency: "USD" }, "total")).toThrow(
      InvalidFieldValueError
    );
  });

  it("still prints blank for a value the data does not carry at all", () => {
    expect(format(money, null, "total")).toBe(blank);
    expect(format(money, undefined, "total")).toBe(blank);
  });

  it("leaves a value the serializer accepts exactly as it was", () => {
    // An address may legitimately carry a blank line two. It serializes, so the
    // rejection path never runs and the rule never sees it.
    const address = { type: "address", label: "Ship to", required: false, visible: true } as const;
    const printed = format(
      address,
      { line1: "88 Wharf Road", line2: null, locality: "Oakland", region: "CA", postalCode: "94607", country: "US" },
      "shipTo"
    );
    expect(printed).toContain("88 Wharf Road");
    expect(printed).toContain("Oakland");
  });
});

describe("a partial formatter, for a document still being filled", () => {
  const { format, serializers: registry, blank } = createValueFormatter({ partial: true });

  it("prints blank for a money whose amount has not landed", () => {
    expect(format(money, { amount: null, currency: "USD" }, "total")).toBe(blank);
  });

  it("prints blank for a def whose fields have not landed", () => {
    expect(
      formatByType("money", { amount: null, currency: null }, registry, blank, "defs.subtotal", true)
    ).toBe(blank);
  });

  it("throws for that same def when the caller is not partial", () => {
    expect(() =>
      formatByType("money", { amount: null, currency: null }, registry, blank, "defs.subtotal")
    ).toThrow(InvalidFieldValueError);
  });

  it("honours a caller's own blank", () => {
    const custom = createValueFormatter({ partial: true, blank: "TBD" });
    expect(custom.format(money, { amount: null, currency: "USD" }, "total")).toBe("TBD");
  });

  it("still throws for a value that is complete and wrong", () => {
    expect(() => format(money, { amount: "12", currency: "USD" }, "total")).toThrow(
      InvalidFieldValueError
    );
    expect(() => format(percentage, "eight", "taxRatePercent")).toThrow(InvalidFieldValueError);
  });

  it("still throws for a value that is wrong AND half-supplied", () => {
    expect(() => format(money, { amount: "12", currency: null }, "total")).toThrow(
      InvalidFieldValueError
    );
  });
});
