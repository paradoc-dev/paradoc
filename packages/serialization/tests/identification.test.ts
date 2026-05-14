/**
 * Tests for identification serializer and Serializers
 * Validates identification document stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testIdentification = {
  type: "PASSPORT",
  number: "AB123456",
  issuer: "USA",
  issueDate: "2020-01-15",
  expiryDate: "2030-01-15",
};

describe("identification Serializers", () => {
  describe("usaSerializers", () => {
    it("identification.stringify with all fields", () => {
      const result =
        usaSerializers.identification.stringify(testIdentification);
      expect(result).toContain("PASSPORT: AB123456");
      expect(result).toContain("USA");
      expect(result).toContain("issued 2020-01-15");
      expect(result).toContain("expires 2030-01-15");
    });

    it("identification.stringify with minimal fields", () => {
      const result = usaSerializers.identification.stringify({
        type: "LICENSE",
        number: "DL123456",
      });
      expect(result).toBe("LICENSE: DL123456");
    });

    it("identification.stringify with issuer only", () => {
      const result = usaSerializers.identification.stringify({
        type: "VISA",
        number: "V987654",
        issuer: "Canada",
      });
      expect(result).toContain("VISA: V987654");
      expect(result).toContain("Canada");
    });

    it("identification.stringify with issue date only", () => {
      const result = usaSerializers.identification.stringify({
        type: "DRIVER_LICENSE",
        number: "DL111",
        issueDate: "2021-06-01",
      });
      expect(result).toContain("DRIVER_LICENSE: DL111");
      expect(result).toContain("issued 2021-06-01");
    });
  });

  describe("euSerializers", () => {
    it("identification.stringify (same as USA)", () => {
      const result = euSerializers.identification.stringify(testIdentification);
      expect(result).toContain("PASSPORT: AB123456");
      expect(result).toContain("USA");
    });
  });

  describe("identification edge cases", () => {
    it("identification.stringify with null returns fallback", () => {
      expect(usaSerializers.identification.stringify(null as any)).toBe("");
    });

    it("identification.stringify with undefined returns fallback", () => {
      expect(usaSerializers.identification.stringify(undefined as any)).toBe(
        ""
      );
    });

    it("identification.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({});
      }).toThrow();
    });

    it("identification.stringify with missing type throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({
          number: "ABC123",
        } as any);
      }).toThrow();
    });

    it("identification.stringify with missing number throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({
          type: "PASSPORT",
        } as any);
      }).toThrow();
    });

    it("identification.stringify with empty type throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({
          type: "",
          number: "ABC123",
        });
      }).toThrow();
    });

    it("identification.stringify with empty number throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({
          type: "PASSPORT",
          number: "",
        });
      }).toThrow();
    });

    it("identification.stringify with numeric type throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({
          type: 123 as any,
          number: "ABC123",
        });
      }).toThrow();
    });

    it("identification.stringify with numeric number throws", () => {
      expect(() => {
        usaSerializers.identification.stringify({
          type: "PASSPORT",
          number: 123 as any,
        });
      }).toThrow();
    });

    it("identification.stringify with array throws", () => {
      expect(() => {
        usaSerializers.identification.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });
});
