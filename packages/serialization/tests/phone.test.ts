/**
 * Tests for phone serializer and Serializers
 * Validates phone stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testPhone = { number: "+12125551234", extension: "123" };

describe("phone Serializers", () => {
  describe("usaSerializers", () => {
    it("phone.stringify E.164 format", () => {
      const result = usaSerializers.phone.stringify(testPhone);
      expect(result).toContain("+12125551234");
      expect(result).toContain("ext. 123");
    });

    it("phone.stringify with non-E.164 string throws", () => {
      expect(() => {
        usaSerializers.phone.stringify("2125551234");
      }).toThrow();
    });
  });

  describe("euSerializers", () => {
    it("phone.stringify E.164 format", () => {
      const result = euSerializers.phone.stringify(testPhone);
      expect(result).toContain("+12125551234");
      expect(result).toContain("ext. 123");
    });

    it("phone.stringify string as-is", () => {
      const result = euSerializers.phone.stringify("+441632960000");
      expect(result).toBe("+441632960000");
    });
  });

  describe("phone edge cases", () => {
    it("phone.stringify with null returns fallback", () => {
      expect(usaSerializers.phone.stringify(null as any)).toBe("");
    });

    it("phone.stringify with undefined returns fallback", () => {
      expect(usaSerializers.phone.stringify(undefined as any)).toBe("");
    });

    it("phone.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.phone.stringify({});
      }).toThrow();
    });

    it("phone.stringify with junk string throws", () => {
      expect(() => {
        usaSerializers.phone.stringify("just some random text");
      }).toThrow();
    });

    it("phone.stringify with number (not string) throws", () => {
      expect(() => {
        usaSerializers.phone.stringify(2125551234 as any);
      }).toThrow();
    });

    it("phone.stringify with + but no digits throws", () => {
      expect(() => {
        usaSerializers.phone.stringify("+");
      }).toThrow();
    });

    it("phone.stringify with + and too few digits throws", () => {
      expect(() => {
        usaSerializers.phone.stringify("+1");
      }).toThrow();
    });

    it("phone.stringify throws for invalid E.164", () => {
      expect(() => {
        usaSerializers.phone.stringify("invalid");
      }).toThrow();
    });

    it("phone.stringify with array throws", () => {
      expect(() => {
        usaSerializers.phone.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });

  describe("E.164 phone validation", () => {
    it("valid E.164 format", () => {
      const valid = usaSerializers.phone.stringify("+12125551234");
      expect(valid).toBe("+12125551234");
    });

    it("non-E.164 string throws", () => {
      expect(() => {
        usaSerializers.phone.stringify("2125551234");
      }).toThrow();
    });

    it("invalid string throws", () => {
      expect(() => {
        usaSerializers.phone.stringify("not-a-phone");
      }).toThrow();
    });
  });
});
