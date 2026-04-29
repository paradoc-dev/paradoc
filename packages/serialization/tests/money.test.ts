/**
 * Tests for money serializer and Serializers
 * Validates money stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers, createSerializer } from "../src/index";

const testMoney = { amount: 1500.5, currency: "USD" };

describe("money Serializers", () => {
  describe("usaSerializers", () => {
    it("money.stringify with object", () => {
      const result = usaSerializers.money.stringify(testMoney);
      expect(result).toContain("$");
      expect(result).toContain("1,500.50");
    });

    it("money.stringify with number", () => {
      const result = usaSerializers.money.stringify(2500);
      expect(result).toContain("$");
      expect(result).toContain("2,500.00");
    });

    it("money.stringify with partial object", () => {
      const result = usaSerializers.money.stringify({ amount: 100 });
      expect(result).toContain("$");
    });

    it("money.stringify with NaN throws error", () => {
      expect(() => {
        usaSerializers.money.stringify(NaN);
      }).toThrow();
    });

    it("money.stringify with custom fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { money: "N/A" },
      });
      const result = serializers.money.stringify(null as any);
      expect(result).toBe("N/A");
    });
  });

  describe("euSerializers", () => {
    it("money.stringify with EUR currency", () => {
      const result = euSerializers.money.stringify({
        amount: 1500.5,
        currency: "EUR",
      });
      expect(result).toContain("€");
      expect(result).toMatch(/1[.,]500/);
    });

    it("money.stringify defaults to EUR", () => {
      const result = euSerializers.money.stringify(2500);
      expect(result).toContain("€");
    });
  });

  describe("money edge cases", () => {
    it("money.stringify with NaN throws error", () => {
      expect(() => {
        usaSerializers.money.stringify(NaN);
      }).toThrow();
    });

    it("money.stringify with Infinity throws error", () => {
      expect(() => {
        usaSerializers.money.stringify(Infinity);
      }).toThrow();
    });

    it("money.stringify with negative Infinity throws error", () => {
      expect(() => {
        usaSerializers.money.stringify(-Infinity);
      }).toThrow();
    });

    it("money.stringify with non-numeric amount throws", () => {
      expect(() => {
        usaSerializers.money.stringify({ amount: "not-a-number" as any });
      }).toThrow();
    });

    it("money.stringify with null and fallback via factory", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { money: "Invalid" },
      });
      expect(serializers.money.stringify(null as any)).toBe("Invalid");
    });

    it("money.stringify with array throws", () => {
      expect(() => {
        usaSerializers.money.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });

  describe("USA vs EU money formatting differences", () => {
    it("USA vs EU money formatting", () => {
      const testVal = { amount: 1234.56, currency: "USD" };
      const usa = usaSerializers.money.stringify(testVal);
      const eu = euSerializers.money.stringify(testVal);

      expect(usa).toContain("$");
      expect(usa).toContain("1,234.56");

      expect(eu).toContain("$");
      expect(eu).toMatch(/1[.,]234/);
    });
  });
});
