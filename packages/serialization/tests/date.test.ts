/**
 * Tests for the date serializer
 * Validates date stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers, createSerializer } from "../src/index";

describe("date Serializers", () => {
  describe("usaSerializers", () => {
    it("date.stringify with an ISO date string", () => {
      expect(usaSerializers.date.stringify("2026-09-04")).toBe("Sep 4, 2026");
    });

    it("date.stringify with an ISO datetime string", () => {
      expect(usaSerializers.date.stringify("2026-09-04T15:30:00Z")).toBe("Sep 4, 2026");
    });

    it("date.stringify with a Date instance", () => {
      expect(usaSerializers.date.stringify(new Date("2026-09-04T00:00:00Z"))).toBe("Sep 4, 2026");
    });

    it("date.stringify with an invalid string throws", () => {
      expect(() => usaSerializers.date.stringify("not-a-date")).toThrow();
    });

    it("date.stringify with a non-string, non-Date value throws", () => {
      expect(() => usaSerializers.date.stringify(12345 as any)).toThrow();
    });

    it("date.stringify with a custom fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { date: "No date" },
      });
      expect(serializers.date.stringify(null as any)).toBe("No date");
    });
  });

  describe("euSerializers", () => {
    it("date.stringify with an ISO date string", () => {
      expect(euSerializers.date.stringify("2026-09-04")).toBe("4. Sept. 2026");
    });

    it("date.stringify is deterministic across calls", () => {
      const first = euSerializers.date.stringify("2026-01-15");
      const second = euSerializers.date.stringify("2026-01-15");
      expect(first).toBe(second);
    });
  });

  describe("USA vs EU date formatting differences", () => {
    it("differ in month/locale presentation", () => {
      const usa = usaSerializers.date.stringify("2026-12-25");
      const eu = euSerializers.date.stringify("2026-12-25");
      expect(usa).toBe("Dec 25, 2026");
      expect(eu).not.toBe(usa);
    });
  });

  describe("time zone handling", () => {
    // These four cases are the ones a UTC-conversion or host-local parse gets
    // wrong. The calendar day always comes from the value's own written
    // digits, never from converting to UTC and never from the host machine's
    // time zone (see `src/serializers/iso.ts`).

    it("reads the calendar day from an offset-bearing datetime's own offset, not from UTC", () => {
      // 23:30 on the 4th at -05:00 is 04:30 on the 5th in UTC. A UTC
      // conversion would print "Sep 5"; the value's own offset says "Sep 4".
      expect(usaSerializers.date.stringify("2026-09-04T23:30:00-05:00")).toBe("Sep 4, 2026");
      expect(euSerializers.date.stringify("2026-09-04T23:30:00-05:00")).toBe("4. Sept. 2026");
    });

    it("treats an offsetless datetime as UTC, never as host-local time", () => {
      expect(usaSerializers.date.stringify("2026-08-26T01:00:00")).toBe("Aug 26, 2026");
      expect(euSerializers.date.stringify("2026-08-26T01:00:00")).toBe("26. Aug. 2026");
    });

    it("handles midnight UTC", () => {
      expect(usaSerializers.date.stringify("2026-01-01T00:00:00Z")).toBe("Jan 1, 2026");
      expect(euSerializers.date.stringify("2026-01-01T00:00:00Z")).toBe("1. Jan. 2026");
    });

    it("accepts a leap day in a leap year", () => {
      expect(usaSerializers.date.stringify("2028-02-29")).toBe("Feb 29, 2028");
      expect(euSerializers.date.stringify("2028-02-29")).toBe("29. Feb. 2028");
    });

    it("rejects a leap day outside a leap year", () => {
      expect(() => usaSerializers.date.stringify("2026-02-29")).toThrow();
    });
  });
});
