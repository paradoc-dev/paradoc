/**
 * Tests for bbox serializer and Serializers
 * Validates bounding box stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testBbox = {
  southWest: { lat: 40.7128, lon: -74.006 },
  northEast: { lat: 40.8, lon: -73.9 },
};

describe("bbox Serializers", () => {
  describe("usaSerializers", () => {
    it("bbox.stringify with valid coordinates", () => {
      const result = usaSerializers.bbox.stringify(testBbox);
      expect(result).toBe("40.7128,-74.006,40.8,-73.9");
    });

    it("bbox.stringify with different coordinates", () => {
      const result = usaSerializers.bbox.stringify({
        southWest: { lat: 0, lon: 0 },
        northEast: { lat: 10, lon: 10 },
      });
      expect(result).toBe("0,0,10,10");
    });
  });

  describe("euSerializers", () => {
    it("bbox.stringify (same as USA)", () => {
      const result = euSerializers.bbox.stringify(testBbox);
      expect(result).toBe("40.7128,-74.006,40.8,-73.9");
    });
  });

  describe("bbox edge cases", () => {
    it("bbox.stringify with null returns fallback", () => {
      expect(usaSerializers.bbox.stringify(null as any)).toBe("");
    });

    it("bbox.stringify with undefined returns fallback", () => {
      expect(usaSerializers.bbox.stringify(undefined as any)).toBe("");
    });

    it("bbox.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({});
      }).toThrow();
    });

    it("bbox.stringify with missing southWest throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({
          northEast: { lat: 40.8, lon: -73.9 },
        } as any);
      }).toThrow();
    });

    it("bbox.stringify with missing northEast throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({
          southWest: { lat: 40.7128, lon: -74.006 },
        } as any);
      }).toThrow();
    });

    it("bbox.stringify with invalid southWest lat throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({
          southWest: { lat: 91, lon: -74.006 },
          northEast: { lat: 40.8, lon: -73.9 },
        });
      }).toThrow();
    });

    it("bbox.stringify with invalid northEast lon throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({
          southWest: { lat: 40.7128, lon: -74.006 },
          northEast: { lat: 40.8, lon: 181 },
        });
      }).toThrow();
    });

    it("bbox.stringify with missing southWest.lat throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({
          southWest: { lon: -74.006 },
          northEast: { lat: 40.8, lon: -73.9 },
        } as any);
      }).toThrow();
    });

    it("bbox.stringify with non-numeric coordinates throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify({
          southWest: { lat: "not-a-number" as any, lon: -74.006 },
          northEast: { lat: 40.8, lon: -73.9 },
        });
      }).toThrow();
    });

    it("bbox.stringify with array throws", () => {
      expect(() => {
        usaSerializers.bbox.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });
});
