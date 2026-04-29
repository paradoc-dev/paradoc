/**
 * Tests for organization serializer and Serializers
 * Validates organization stringification across all locale Serializers
 */

import { describe, it, expect } from "vitest";
import { usaSerializers, euSerializers } from "../src/index";

const testOrganization = { name: "Acme Corp", taxId: "12-3456789" };

describe("organization Serializers", () => {
  describe("usaSerializers", () => {
    it("organization.stringify", () => {
      const result = usaSerializers.organization.stringify(testOrganization);
      expect(result).toContain("Acme Corp");
      expect(result).toContain("Tax ID: 12-3456789");
    });
  });

  describe("euSerializers", () => {
    it("organization.stringify (same as USA)", () => {
      const result = euSerializers.organization.stringify(testOrganization);
      expect(result).toContain("Acme Corp");
    });
  });

  describe("organization edge cases", () => {
    it("organization.stringify with empty object throws", () => {
      expect(() => {
        usaSerializers.organization.stringify({});
      }).toThrow();
    });

    it("organization.stringify with empty string name throws", () => {
      expect(() => {
        usaSerializers.organization.stringify({ name: "" });
      }).toThrow();
    });

    it("organization.stringify with numeric name throws", () => {
      expect(() => {
        usaSerializers.organization.stringify({ name: 123 as any });
      }).toThrow();
    });

    it("organization.stringify throws for invalid data", () => {
      expect(() => {
        usaSerializers.organization.stringify({});
      }).toThrow();
    });

    it("organization.stringify with array throws", () => {
      expect(() => {
        usaSerializers.organization.stringify(["a", "b", "c"] as any);
      }).toThrow();
    });
  });
});
