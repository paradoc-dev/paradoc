import { describe, it, expect } from "vitest";
import {
  usaSerializers,
  euSerializers,
  createSerializer,
} from "../src/index";

describe("@paradoc/serialization - README Examples", () => {
  describe("Pre-built serializers - Money", () => {
    it("should format USD money with USA serializers", () => {
      const result = usaSerializers.money.stringify({
        amount: 1500,
        currency: "USD",
      });
      expect(result).toBe("$1,500.00");
    });

    it("should format EUR money with EU serializers", () => {
      const result = euSerializers.money.stringify({
        amount: 1500,
        currency: "EUR",
      });
      expect(result).toContain("1.500,00");
      expect(result).toContain("€");
    });

    it("should format GBP money with USA serializers", () => {
      const result = usaSerializers.money.stringify({
        amount: 1500,
        currency: "GBP",
      });
      // USA serializer uses en-US locale which shows GBP with pound symbol
      expect(result).toContain("1,500.00");
    });
  });

  describe("Pre-built serializers - Address", () => {
    it("should format USA address", () => {
      const result = usaSerializers.address.stringify({
        line1: "123 Main St",
        locality: "New York",
        region: "NY",
        postalCode: "10001",
        country: "USA",
      });
      expect(result).toContain("123 Main St");
      expect(result).toContain("New York");
      expect(result).toContain("NY");
      expect(result).toContain("10001");
    });

    it("should format EU address", () => {
      const result = euSerializers.address.stringify({
        line1: "10 Downing St",
        locality: "London",
        postalCode: "SW1A 2AA",
        country: "UK",
      });
      expect(result).toContain("10 Downing St");
      expect(result).toContain("SW1A 2AA");
      expect(result).toContain("London");
    });
  });

  describe("Pre-built serializers - Phone", () => {
    it("should format E.164 phone number", () => {
      const result = usaSerializers.phone.stringify({ number: "+12125551234" });
      expect(result).toBe("+12125551234");
    });
  });

  describe("Pre-built serializers - Person", () => {
    it("should format person name", () => {
      const result = usaSerializers.person.stringify({
        firstName: "Alice",
        lastName: "Johnson",
        name: "Alice Johnson",
      });
      expect(result).toBe("Alice Johnson");
    });
  });

  describe("Pre-built serializers - Organization", () => {
    it("should format organization with tax ID", () => {
      const result = usaSerializers.organization.stringify({
        name: "Acme Corp",
        taxId: "12-3456789",
      });
      expect(result).toContain("Acme Corp");
      expect(result).toContain("12-3456789");
    });
  });

  describe("Factory function - createSerializer", () => {
    it("should create USA serializers via factory", () => {
      const serializers = createSerializer({ regionFormat: "us" });
      const result = serializers.money.stringify({
        amount: 99.99,
        currency: "USD",
      });
      expect(result).toContain("99.99");
      expect(result).toContain("$");
    });

    it("should create EU serializers via factory", () => {
      const serializers = createSerializer({ regionFormat: "eu" });
      const result = serializers.money.stringify({
        amount: 99.99,
        currency: "EUR",
      });
      expect(result).toContain("99,99");
      expect(result).toContain("€");
    });

    it("should create USA serializers via factory with default", () => {
      const serializers = createSerializer({});
      const result = serializers.money.stringify({
        amount: 99.99,
        currency: "GBP",
      });
      expect(result).toContain("99.99");
    });
  });

  describe("Fallback configuration", () => {
    it("should use configured fallback for money when serialization fails", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { money: "N/A" },
      });
      // Invalid value should trigger fallback
      const result = serializers.money.stringify(null as any);
      expect(result).toBe("N/A");
    });

    it("should use configured fallback for address when serialization fails", () => {
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks: { address: "Address not available" },
      });
      // Invalid value should trigger fallback
      const result = serializers.address.stringify(null as any);
      expect(result).toBe("Address not available");
    });

    it("should use empty string as default fallback", () => {
      const serializers = createSerializer({ regionFormat: "us" });
      // Invalid value should use default empty string fallback
      const result = serializers.money.stringify(null as any);
      expect(result).toBe("");
    });

    it("should support fallbacks for all serializer types", () => {
      const fallbacks = {
        money: "N/A",
        address: "–",
        phone: "-",
        person: "Unknown",
        organization: "Unnamed",
        party: "Unknown party",
        coordinate: "No coords",
        bbox: "No bounds",
        duration: "No duration",
        identification: "No ID",
      };
      const serializers = createSerializer({
        regionFormat: "us",
        fallbacks,
      });

      expect(serializers.money.stringify(null as any)).toBe("N/A");
      expect(serializers.address.stringify(null as any)).toBe("–");
      expect(serializers.phone.stringify(null as any)).toBe("-");
      expect(serializers.person.stringify(null as any)).toBe("Unknown");
      expect(serializers.organization.stringify(null as any)).toBe("Unnamed");
      expect(serializers.party.stringify(null as any)).toBe("Unknown party");
      expect(serializers.coordinate.stringify(null as any)).toBe("No coords");
      expect(serializers.bbox.stringify(null as any)).toBe("No bounds");
      expect(serializers.duration.stringify(null as any)).toBe("No duration");
      expect(serializers.identification.stringify(null as any)).toBe("No ID");
    });
  });
});
