/**
 * Tests for the number serializer
 * Validates plain numeric stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers, createSerializer } from "../src/index";

describe("number Serializers", () => {
  describe("usaSerializers", () => {
    it("number.stringify with grouping", () => {
      expect(usaSerializers.number.stringify(1234567.891)).toBe("1,234,567.891");
    });

    it("number.stringify with a whole number", () => {
      expect(usaSerializers.number.stringify(3)).toBe("3");
    });

    it("number.stringify with a negative number", () => {
      expect(usaSerializers.number.stringify(-42)).toBe("-42");
    });

    it("number.stringify with NaN throws", () => {
      expect(() => usaSerializers.number.stringify(NaN)).toThrow();
    });

    it("number.stringify with Infinity throws", () => {
      expect(() => usaSerializers.number.stringify(Infinity)).toThrow();
    });

    it("number.stringify with a non-number value throws", () => {
      expect(() => usaSerializers.number.stringify("42" as any)).toThrow();
    });

    it("number.stringify with a custom fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { number: "N/A" },
      });
      expect(serializers.number.stringify(null as any)).toBe("N/A");
    });
  });

  describe("euSerializers", () => {
    it("number.stringify with EU grouping and decimal separators", () => {
      expect(euSerializers.number.stringify(1234567.891)).toBe("1.234.567,891");
    });

    it("number.stringify is deterministic across calls", () => {
      const first = euSerializers.number.stringify(42.5);
      const second = euSerializers.number.stringify(42.5);
      expect(first).toBe(second);
    });
  });

  describe("USA vs EU number formatting differences", () => {
    it("differ in grouping and decimal separators", () => {
      const usa = usaSerializers.number.stringify(1234567.891);
      const eu = euSerializers.number.stringify(1234567.891);
      expect(usa).not.toBe(eu);
    });
  });
});
