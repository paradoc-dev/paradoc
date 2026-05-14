/**
 * Tests for duration serializer and Serializers
 * Validates ISO 8601 duration stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

describe("duration Serializers", () => {
  describe("usaSerializers", () => {
    it("duration.stringify with 1 year", () => {
      const result = usaSerializers.duration.stringify("P1Y");
      expect(result).toBe("1 year");
    });

    it("duration.stringify with multiple years", () => {
      const result = usaSerializers.duration.stringify("P5Y");
      expect(result).toBe("5 years");
    });

    it("duration.stringify with 1 month", () => {
      const result = usaSerializers.duration.stringify("P1M");
      expect(result).toBe("1 month");
    });

    it("duration.stringify with multiple months", () => {
      const result = usaSerializers.duration.stringify("P3M");
      expect(result).toBe("3 months");
    });

    it("duration.stringify with 1 day", () => {
      const result = usaSerializers.duration.stringify("P1D");
      expect(result).toBe("1 day");
    });

    it("duration.stringify with multiple days", () => {
      const result = usaSerializers.duration.stringify("P5D");
      expect(result).toBe("5 days");
    });

    it("duration.stringify with weeks", () => {
      const result = usaSerializers.duration.stringify("P2W");
      expect(result).toBe("2 weeks");
    });

    it("duration.stringify with 1 hour", () => {
      const result = usaSerializers.duration.stringify("PT1H");
      expect(result).toBe("1 hour");
    });

    it("duration.stringify with multiple hours", () => {
      const result = usaSerializers.duration.stringify("PT4H");
      expect(result).toBe("4 hours");
    });

    it("duration.stringify with 1 minute", () => {
      const result = usaSerializers.duration.stringify("PT1M");
      expect(result).toBe("1 minute");
    });

    it("duration.stringify with multiple minutes", () => {
      const result = usaSerializers.duration.stringify("PT30M");
      expect(result).toBe("30 minutes");
    });

    it("duration.stringify with 1 second", () => {
      const result = usaSerializers.duration.stringify("PT1S");
      expect(result).toBe("1 second");
    });

    it("duration.stringify with multiple seconds", () => {
      const result = usaSerializers.duration.stringify("PT45S");
      expect(result).toBe("45 seconds");
    });

    it("duration.stringify with decimal seconds", () => {
      const result = usaSerializers.duration.stringify("PT1.5S");
      expect(result).toBe("1.5 seconds");
    });

    it("duration.stringify with complex duration", () => {
      const result = usaSerializers.duration.stringify("P1Y2M3DT4H5M6S");
      expect(result).toBe("1 year, 2 months, 3 days, 4 hours, 5 minutes, 6 seconds");
    });

    it("duration.stringify with date parts only", () => {
      const result = usaSerializers.duration.stringify("P2Y6M");
      expect(result).toBe("2 years, 6 months");
    });

    it("duration.stringify with time parts only", () => {
      const result = usaSerializers.duration.stringify("PT2H30M");
      expect(result).toBe("2 hours, 30 minutes");
    });
  });

  describe("euSerializers", () => {
    it("duration.stringify (same as USA)", () => {
      const result = euSerializers.duration.stringify("P1Y");
      expect(result).toBe("1 year");
    });

    it("duration.stringify complex (same as USA)", () => {
      const result = euSerializers.duration.stringify("P1Y2M3D");
      expect(result).toBe("1 year, 2 months, 3 days");
    });
  });

  describe("duration edge cases", () => {
    it("duration.stringify with null returns fallback", () => {
      expect(usaSerializers.duration.stringify(null as any)).toBe("");
    });

    it("duration.stringify with undefined returns fallback", () => {
      expect(usaSerializers.duration.stringify(undefined as any)).toBe("");
    });

    it("duration.stringify with empty string throws", () => {
      expect(() => {
        usaSerializers.duration.stringify("");
      }).toThrow();
    });

    it("duration.stringify with invalid format throws", () => {
      expect(() => {
        usaSerializers.duration.stringify("1Y");
      }).toThrow();
    });

    it("duration.stringify with lowercase p throws", () => {
      expect(() => {
        usaSerializers.duration.stringify("p1Y");
      }).toThrow();
    });

    it("duration.stringify with non-string throws", () => {
      expect(() => {
        usaSerializers.duration.stringify(123 as any);
      }).toThrow();
    });

    it("duration.stringify with array throws", () => {
      expect(() => {
        usaSerializers.duration.stringify(["P1Y"] as any);
      }).toThrow();
    });

    it("duration.stringify with P only returns 0 seconds", () => {
      const result = usaSerializers.duration.stringify("P");
      expect(result).toBe("0 seconds");
    });

    it("duration.stringify with PT only returns 0 seconds", () => {
      const result = usaSerializers.duration.stringify("PT");
      expect(result).toBe("0 seconds");
    });
  });
});
