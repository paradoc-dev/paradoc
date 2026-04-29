/**
 * Tests for address serializer and serializers
 * Validates address stringification across all locale serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testAddress = {
  line1: "123 Main St",
  line2: "Apt 4B",
  locality: "New York",
  region: "NY",
  postalCode: "10001",
  country: "USA",
};

describe("address serializers", () => {
  describe("usaSerializers", () => {
    it("address.stringify USA format", () => {
      const result = usaSerializers.address.stringify(testAddress);
      expect(result).toBe("123 Main St, Apt 4B, New York, NY, 10001, USA");
    });

    it("address.stringify with missing fields", () => {
      const result = usaSerializers.address.stringify({
        line1: "456 Oak Ave",
        locality: "Boston",
        region: "MA",
        postalCode: "02101",
      });
      expect(result).toContain("456 Oak Ave");
      expect(result).toContain("Boston");
    });
  });

  describe("euSerializers", () => {
    it("address.stringify EU format (postal code first)", () => {
      const result = euSerializers.address.stringify(testAddress);
      expect(result).toContain("10001");
      expect(result).toContain("New York");
      expect(result).toContain("USA");
    });
  });

  describe("address edge cases", () => {
    it("address.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.address.stringify({});
      }).toThrow();
    });

    it("address.stringify handles missing optional fields", () => {
      const minimalAddress = { line1: "123 Main" };
      const result = usaSerializers.address.stringify(minimalAddress);
      expect(result).toContain("123 Main");
    });

    it("address.stringify with numeric line1 coerces to string", () => {
      const result = usaSerializers.address.stringify({ line1: 123 as any });
      expect(result).toBe("123");
    });

    it("address.stringify with all fields as null throws", () => {
      expect(() => {
        usaSerializers.address.stringify({
          line1: null,
          line2: null,
          locality: null,
          region: null,
          postalCode: null,
          country: null,
        } as any);
      }).toThrow();
    });

    it("address.stringify with only falsy fields throws", () => {
      expect(() => {
        usaSerializers.address.stringify({
          line1: "",
          line2: "",
          locality: "",
          region: "",
          postalCode: "",
          country: "",
        } as any);
      }).toThrow();
    });

    it("address.stringify with array throws", () => {
      expect(() => {
        usaSerializers.address.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });

  describe("USA vs EU address formatting differences", () => {
    it("USA vs EU address formatting", () => {
      const addr = {
        line1: "10 Downing St",
        locality: "London",
        postalCode: "SW1A 2AA",
        country: "UK",
      };

      const usa = usaSerializers.address.stringify(addr);
      const eu = euSerializers.address.stringify(addr);

      expect(usa).toContain("10 Downing St");
      expect(eu).toContain("10 Downing St");

      expect(usa.length).toBeGreaterThan(0);
      expect(eu.length).toBeGreaterThan(0);
    });
  });
});
