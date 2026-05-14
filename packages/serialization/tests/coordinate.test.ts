/**
 * Tests for coordinate serializer and Serializers
 * Validates geographic coordinate stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testCoordinate = { lat: 40.7128, lon: -74.006 };

describe("coordinate Serializers", () => {
  describe("usaSerializers", () => {
    it("coordinate.stringify with valid coordinates", () => {
      const result = usaSerializers.coordinate.stringify(testCoordinate);
      expect(result).toBe("40.7128,-74.006");
    });

    it("coordinate.stringify at equator", () => {
      const result = usaSerializers.coordinate.stringify({ lat: 0, lon: 0 });
      expect(result).toBe("0,0");
    });

    it("coordinate.stringify at poles", () => {
      const result = usaSerializers.coordinate.stringify({ lat: 90, lon: 180 });
      expect(result).toBe("90,180");
    });

    it("coordinate.stringify with negative coordinates", () => {
      const result = usaSerializers.coordinate.stringify({
        lat: -33.8688,
        lon: 151.2093,
      });
      expect(result).toBe("-33.8688,151.2093");
    });
  });

  describe("euSerializers", () => {
    it("coordinate.stringify (same as USA)", () => {
      const result = (euSerializers as any).coordinate.stringify(
        testCoordinate
      );
      expect(result).toBe("40.7128,-74.006");
    });
  });

  describe("coordinate edge cases", () => {
    it("coordinate.stringify with null returns fallback", () => {
      expect(usaSerializers.coordinate.stringify(null as any)).toBe("");
    });

    it("coordinate.stringify with undefined returns fallback", () => {
      expect(usaSerializers.coordinate.stringify(undefined as any)).toBe("");
    });

    it("coordinate.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({});
      }).toThrow();
    });

    it("coordinate.stringify with missing lat throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({ lon: -74.006 } as any);
      }).toThrow();
    });

    it("coordinate.stringify with missing lon throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({ lat: 40.7128 } as any);
      }).toThrow();
    });

    it("coordinate.stringify with lat out of range throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({ lat: 91, lon: 0 });
      }).toThrow();
    });

    it("coordinate.stringify with lat below range throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({ lat: -91, lon: 0 });
      }).toThrow();
    });

    it("coordinate.stringify with lon out of range throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({ lat: 0, lon: 181 });
      }).toThrow();
    });

    it("coordinate.stringify with lon below range throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({ lat: 0, lon: -181 });
      }).toThrow();
    });

    it("coordinate.stringify with non-numeric lat throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({
          lat: "not-a-number" as any,
          lon: 0,
        });
      }).toThrow();
    });

    it("coordinate.stringify with non-numeric lon throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify({
          lat: 0,
          lon: "not-a-number" as any,
        });
      }).toThrow();
    });

    it("coordinate.stringify with array throws", () => {
      expect(() => {
        usaSerializers.coordinate.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });
});
