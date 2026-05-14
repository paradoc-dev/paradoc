/**
 * Tests for person serializer and Serializers
 * Validates person stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testPerson = {
  firstName: "John",
  middleName: "Michael",
  lastName: "Doe",
  title: "Dr.",
  suffix: "Jr.",
};

describe("person Serializers", () => {
  describe("usaSerializers", () => {
    it("person.stringify with all fields", () => {
      const result = usaSerializers.person.stringify(testPerson);
      expect(result).toContain("Dr.");
      expect(result).toContain("John");
      expect(result).toContain("Michael");
      expect(result).toContain("Doe");
      expect(result).toContain("Jr.");
    });

    it("person.stringify with name", () => {
      const result = usaSerializers.person.stringify({
        name: "Jane Smith",
      });
      expect(result).toBe("Jane Smith");
    });
  });

  describe("euSerializers", () => {
    it("person.stringify (same as USA)", () => {
      const result = euSerializers.person.stringify(testPerson);
      expect(result).toContain("John");
      expect(result).toContain("Doe");
    });
  });

  describe("person edge cases", () => {


    it("person.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.person.stringify({});
      }).toThrow();
    });

    it("person.stringify with numeric firstName coerces to string", () => {
      const result = usaSerializers.person.stringify({ firstName: 123 as any });
      expect(result).toBe("123");
    });

    it("person.stringify with all name fields as null throws", () => {
      expect(() => {
        usaSerializers.person.stringify({
          name: null,
          firstName: null,
          lastName: null,
          middleName: null,
          title: null,
          suffix: null,
        } as any);
      }).toThrow();
    });

    it("person.stringify throws for invalid data", () => {
      expect(() => {
        usaSerializers.person.stringify({});
      }).toThrow();
    });

    it("person.stringify with array throws", () => {
      expect(() => {
        usaSerializers.person.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });
});
