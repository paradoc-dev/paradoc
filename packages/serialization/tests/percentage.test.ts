/**
 * Tests for the percentage serializer
 * Validates percentage stringification across all locale Serializers
 *
 * Percentage values are on a 0-100 scale (8.25 means "8.25%"), matching the
 * `percentage` primitive and form field.
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers, createSerializer } from "../src/index";

describe("percentage Serializers", () => {
  describe("usaSerializers", () => {
    it("percentage.stringify with a decimal value", () => {
      expect(usaSerializers.percentage.stringify(8.25)).toBe("8.25%");
    });

    it("percentage.stringify with a whole number", () => {
      expect(usaSerializers.percentage.stringify(50)).toBe("50%");
    });

    it("percentage.stringify with zero", () => {
      expect(usaSerializers.percentage.stringify(0)).toBe("0%");
    });

    it("percentage.stringify with a negative value (no range check)", () => {
      // The percentage field and its `percentage` primitive allow negative
      // values by default; the serializer applies no range check of its own.
      expect(usaSerializers.percentage.stringify(-10)).toBe("-10%");
    });

    it("percentage.stringify with NaN throws", () => {
      expect(() => usaSerializers.percentage.stringify(NaN)).toThrow();
    });

    it("percentage.stringify with a non-number value throws", () => {
      expect(() => usaSerializers.percentage.stringify("8.25" as any)).toThrow();
    });

    it("percentage.stringify with a custom fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { percentage: "N/A" },
      });
      expect(serializers.percentage.stringify(null as any)).toBe("N/A");
    });
  });

  describe("euSerializers", () => {
    it("percentage.stringify with a decimal value", () => {
      expect(euSerializers.percentage.stringify(8.25)).toBe("8,25%");
    });

    it("percentage.stringify is deterministic across calls", () => {
      const first = euSerializers.percentage.stringify(12.5);
      const second = euSerializers.percentage.stringify(12.5);
      expect(first).toBe(second);
    });
  });

  describe("USA vs EU percentage formatting differences", () => {
    it("differ in decimal separator", () => {
      const usa = usaSerializers.percentage.stringify(8.25);
      const eu = euSerializers.percentage.stringify(8.25);
      expect(usa).toBe("8.25%");
      expect(eu).toBe("8,25%");
    });
  });
});
