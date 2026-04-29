/**
 * Tests for party serializer and Serializers
 * Validates party (Person | Organization) stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

describe("party Serializers", () => {
  describe("usaSerializers", () => {
    it("party.stringify with person", () => {
      const result = usaSerializers.party.stringify({
        firstName: "Alice",
        lastName: "Johnson",
      });
      expect(result).toContain("Alice");
      expect(result).toContain("Johnson");
    });

    it("party.stringify with organization", () => {
      const result = usaSerializers.party.stringify({ name: "Tech Inc" });
      expect(result).toContain("Tech Inc");
    });
  });

  describe("euSerializers", () => {
    it("party.stringify with person", () => {
      const result = euSerializers.party.stringify({
        firstName: "Bob",
        lastName: "Smith",
      });
      expect(result).toContain("Bob");
      expect(result).toContain("Smith");
    });

    it("party.stringify with organization", () => {
      const result = euSerializers.party.stringify({ name: "Tech Inc" });
      expect(result).toContain("Tech Inc");
    });
  });

  describe("party edge cases", () => {


    it("party.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.party.stringify({});
      }).toThrow();
    });

    it("party.stringify with unrecognizable object throws", () => {
      expect(() => {
        usaSerializers.party.stringify({ foo: "bar", baz: "qux" } as any);
      }).toThrow();
    });

    it("party.stringify with array throws", () => {
      expect(() => {
        usaSerializers.party.stringify([] as any);
      }).toThrow();
    });

    it("party.stringify throws for invalid data", () => {
      expect(() => {
        usaSerializers.party.stringify({});
      }).toThrow();
    });
  });
});
