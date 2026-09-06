/**
 * `isDeeplyBlank` tells "no data yet" apart from "a real value with nothing
 * in its own enumerable properties" — a `Date`, most obviously, whose state
 * lives outside the properties `Object.values` can see.
 */

import { describe, expect, it } from "vitest";

import { isDeeplyBlank } from "../src/lib/format";

describe("isDeeplyBlank", () => {
  it("is true for the blank primitives", () => {
    expect(isDeeplyBlank(null)).toBe(true);
    expect(isDeeplyBlank(undefined)).toBe(true);
    expect(isDeeplyBlank("")).toBe(true);
  });

  it("is false for a real primitive", () => {
    expect(isDeeplyBlank(0)).toBe(false);
    expect(isDeeplyBlank("Ada Lovelace")).toBe(false);
    expect(isDeeplyBlank(false)).toBe(false);
  });

  it("is true for a plain object whose every leaf is blank", () => {
    expect(isDeeplyBlank({ amount: null, currency: null })).toBe(true);
    expect(isDeeplyBlank({ amount: null, currency: { code: null } })).toBe(true);
  });

  it("is false for a plain object carrying one real value", () => {
    expect(isDeeplyBlank({ amount: null, currency: "USD" })).toBe(false);
  });

  it("is true for an empty array and for an array of blanks", () => {
    expect(isDeeplyBlank([])).toBe(true);
    expect(isDeeplyBlank([null, undefined, ""])).toBe(true);
  });

  it("is false for a Date, however empty Object.values reports it", () => {
    // A `Date`'s state is not in its own enumerable properties, so
    // `Object.values(new Date())` is `[]` — every() on that is vacuously
    // true, which is exactly the false positive this guards against.
    expect(Object.values(new Date())).toEqual([]);
    expect(isDeeplyBlank(new Date())).toBe(false);
  });

  it("is false for other non-plain objects: RegExp, Map, a class instance", () => {
    expect(isDeeplyBlank(/x/)).toBe(false);
    expect(isDeeplyBlank(new Map([["a", 1]]))).toBe(false);

    class Money {
      amount = 0;
    }
    expect(isDeeplyBlank(new Money())).toBe(false);
  });

  it("is true for Object.create(null), a plain object with no prototype", () => {
    expect(isDeeplyBlank(Object.create(null))).toBe(true);
  });
});
