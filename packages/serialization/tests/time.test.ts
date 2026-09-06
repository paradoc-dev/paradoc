/**
 * Tests for the time serializer
 * Validates time-of-day stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers, createSerializer } from "../src/index";

describe("time Serializers", () => {
  describe("usaSerializers", () => {
    it("time.stringify with HH:MM:SS", () => {
      expect(usaSerializers.time.stringify("15:30:00")).toBe("3:30 PM");
    });

    it("time.stringify with HH:MM", () => {
      expect(usaSerializers.time.stringify("09:05")).toBe("9:05 AM");
    });

    it("time.stringify with an invalid string throws", () => {
      expect(() => usaSerializers.time.stringify("25:00")).toThrow();
    });

    it("time.stringify with a non-string value throws", () => {
      expect(() => usaSerializers.time.stringify(1530 as any)).toThrow();
    });

    it("time.stringify with a custom fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { time: "No time" },
      });
      expect(serializers.time.stringify(null as any)).toBe("No time");
    });
  });

  describe("euSerializers", () => {
    it("time.stringify with HH:MM:SS", () => {
      expect(euSerializers.time.stringify("15:30:00")).toBe("15:30");
    });

    it("time.stringify is deterministic across calls", () => {
      const first = euSerializers.time.stringify("09:05:00");
      const second = euSerializers.time.stringify("09:05:00");
      expect(first).toBe(second);
    });
  });

  describe("USA vs EU time formatting differences", () => {
    it("differ between 12-hour and 24-hour presentation", () => {
      const usa = usaSerializers.time.stringify("15:30:00");
      const eu = euSerializers.time.stringify("15:30:00");
      expect(usa).toBe("3:30 PM");
      expect(eu).toBe("15:30");
    });
  });
});
