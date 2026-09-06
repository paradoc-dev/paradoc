/**
 * Tests for the datetime serializer
 * Validates datetime stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers, createSerializer } from "../src/index";

describe("datetime Serializers", () => {
  describe("usaSerializers", () => {
    it("datetime.stringify with an ISO datetime string", () => {
      expect(usaSerializers.datetime.stringify("2026-09-04T15:30:00Z")).toBe("Sep 4, 2026, 3:30 PM");
    });

    it("datetime.stringify with a Date instance", () => {
      expect(usaSerializers.datetime.stringify(new Date("2026-09-04T15:30:00Z"))).toBe(
        "Sep 4, 2026, 3:30 PM"
      );
    });

    it("datetime.stringify with an invalid string throws", () => {
      expect(() => usaSerializers.datetime.stringify("not-a-datetime")).toThrow();
    });

    it("datetime.stringify with a non-string, non-Date value throws", () => {
      expect(() => usaSerializers.datetime.stringify(12345 as any)).toThrow();
    });

    it("datetime.stringify with a custom fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { datetime: "No datetime" },
      });
      expect(serializers.datetime.stringify(null as any)).toBe("No datetime");
    });
  });

  describe("euSerializers", () => {
    it("datetime.stringify with an ISO datetime string", () => {
      expect(euSerializers.datetime.stringify("2026-09-04T15:30:00Z")).toBe("4. Sept. 2026, 15:30");
    });

    it("datetime.stringify is deterministic across calls", () => {
      const first = euSerializers.datetime.stringify("2026-01-15T09:05:00Z");
      const second = euSerializers.datetime.stringify("2026-01-15T09:05:00Z");
      expect(first).toBe(second);
    });
  });

  describe("USA vs EU datetime formatting differences", () => {
    it("differ in date and time presentation", () => {
      const usa = usaSerializers.datetime.stringify("2026-09-04T09:05:00Z");
      const eu = euSerializers.datetime.stringify("2026-09-04T09:05:00Z");
      expect(usa).toContain("9:05 AM");
      expect(eu).not.toBe(usa);
    });
  });

  describe("time zone handling", () => {
    // Same four cases as the date serializer's own suite (see
    // `src/serializers/iso.ts`): the wall-clock components always come from
    // the value's own written digits, never from a UTC conversion and never
    // from the host machine's time zone.

    it("reads the clock time in an offset-bearing value's own offset, not in UTC", () => {
      // 23:30 at -05:00 is 04:30Z the next day. A UTC conversion would print
      // "Sep 5, ... 4:30 AM"; the value's own offset says "Sep 4, ... 11:30 PM".
      expect(usaSerializers.datetime.stringify("2026-09-04T23:30:00-05:00")).toBe("Sep 4, 2026, 11:30 PM");
      expect(euSerializers.datetime.stringify("2026-09-04T23:30:00-05:00")).toBe("4. Sept. 2026, 23:30");
    });

    it("treats an offsetless datetime as UTC, never as host-local time", () => {
      expect(usaSerializers.datetime.stringify("2026-08-26T01:00:00")).toBe("Aug 26, 2026, 1:00 AM");
      expect(euSerializers.datetime.stringify("2026-08-26T01:00:00")).toBe("26. Aug. 2026, 1:00");
    });

    it("handles midnight UTC", () => {
      expect(usaSerializers.datetime.stringify("2026-01-01T00:00:00Z")).toBe("Jan 1, 2026, 12:00 AM");
      expect(euSerializers.datetime.stringify("2026-01-01T00:00:00Z")).toBe("1. Jan. 2026, 0:00");
    });

    it("accepts a leap day in a leap year", () => {
      expect(usaSerializers.datetime.stringify("2028-02-29T12:00:00Z")).toBe("Feb 29, 2028, 12:00 PM");
      expect(euSerializers.datetime.stringify("2028-02-29T12:00:00Z")).toBe("29. Feb. 2028, 12:00");
    });

    it("rejects a leap day outside a leap year", () => {
      expect(() => usaSerializers.datetime.stringify("2026-02-29T12:00:00Z")).toThrow();
    });
  });
});
