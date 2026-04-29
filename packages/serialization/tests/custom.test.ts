/**
 * Tests for custom SerializerRegistry implementations
 * Validates that custom serializers can be created and used correctly
 */

import { describe, it, expect } from "vitest";
import type { SerializerRegistry } from "../src/index";
import { createSerializer } from "../src/index";

describe("Custom SerializerRegistry implementations", () => {
  it("allows creating a simple custom money serializer", () => {
    const customSerializers: SerializerRegistry = {
      money: {
        stringify: (value) => {
          const amount =
            typeof value === "number" ? value : value.amount ?? 0;
          return `$${amount.toFixed(2)}`;
        },
      },
      address: {
        stringify: (value) => {
          const addr = value as Record<string, unknown>;
          return [addr.line1, addr.locality, addr.country]
            .filter(Boolean)
            .join(", ");
        },
      },
      phone: {
        stringify: (value) => {
          const phone = value as Record<string, unknown>;
          return typeof value === "string" ? value : String(phone.number || "");
        },
      },
      person: {
        stringify: (value) => "Custom Person",
      },
      organization: {
        stringify: (value) => "Custom Org",
      },
      party: {
        stringify: (value) => "Custom Party",
      },
      coordinate: {
        stringify: (value) => "Custom Coordinate",
      },
      bbox: {
        stringify: (value) => "Custom Bbox",
      },
      duration: {
        stringify: (value) => "Custom Duration",
      },
      identification: {
        stringify: (value) => "Custom ID",
      },
      attachment: {
        stringify: (value) => "Custom Attachment",
      },
      signature: {
        stringify: (value) => "Custom Signature",
      },
    };

    expect(customSerializers.money.stringify(100)).toBe("$100.00");
    expect(customSerializers.money.stringify({ amount: 50, currency: "USD" })).toBe("$50.00");
  });

  it("allows custom address serializer with simple formatting", () => {
    const customSerializers: SerializerRegistry = {
      money: {
        stringify: (value) => "",
      },
      address: {
        stringify: (value) => {
          const addr = value as Record<string, unknown>;
          return [addr.line1, addr.locality, addr.country]
            .filter(Boolean)
            .join(", ");
        },
      },
      phone: {
        stringify: (value) => "",
      },
      person: {
        stringify: (value) => "",
      },
      organization: {
        stringify: (value) => "",
      },
      party: {
        stringify: (value) => "",
      },
      coordinate: {
        stringify: (value) => "",
      },
      bbox: {
        stringify: (value) => "",
      },
      duration: {
        stringify: (value) => "",
      },
      identification: {
        stringify: (value) => "",
      },
      attachment: {
        stringify: (value) => "",
      },
      signature: {
        stringify: (value) => "",
      },
    };

    const result = customSerializers.address.stringify({
      line1: "123 Main St",
      locality: "Boston",
      country: "USA",
    });

    expect(result).toBe("123 Main St, Boston, USA");
  });

  it("uses configured fallback with factory-created serializers", () => {
    const serializers = createSerializer({
      regionFormat: "us",
      fallbacks: { phone: "Phone unavailable" },
    });

    const result = serializers.phone.stringify(null as any);
    expect(result).toBe("Phone unavailable");
  });

  it("uses configured fallback when money amount is null", () => {
    const serializers = createSerializer({
      regionFormat: "us",
      fallbacks: { money: "Amount not available" },
    });

    const result = serializers.money.stringify(null as any);
    expect(result).toBe("Amount not available");
  });

  it("supports different fallbacks for different serializer types", () => {
    const serializers = createSerializer({
      regionFormat: "us",
      fallbacks: {
        money: "$0.00",
        address: "No address",
        phone: "No phone",
        person: "Unknown person",
      },
    });

    expect(serializers.money.stringify(null as any)).toBe("$0.00");
    expect(serializers.address.stringify(null as any)).toBe("No address");
    expect(serializers.phone.stringify(null as any)).toBe("No phone");
    expect(serializers.person.stringify(null as any)).toBe("Unknown person");
  });
});
