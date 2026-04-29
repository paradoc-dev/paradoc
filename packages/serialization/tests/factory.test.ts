/**
 * Tests for createSerializer factory function
 * Validates serializer registry creation with different region configurations
 */

import { describe, it, expect } from "vitest";
import type {
  Money,
  Address,
  Phone,
  Person,
  Organization,
} from "@paradoc/types";
import {
  usaSerializers,
  euSerializers,
  createSerializer,
  type SerializerRegistry,
} from "../src/index";

const testMoney = { amount: 1500.5, currency: "USD" };
const testAddress = {
  line1: "123 Main St",
  line2: "Apt 4B",
  locality: "New York",
  region: "NY",
  postalCode: "10001",
  country: "USA",
};

describe("createSerializer factory", () => {
  it("creates USA serializers with US region", () => {
    const serializers = createSerializer({ regionFormat: "us" });
    const result = serializers.money.stringify(1000);
    expect(result).toContain("$");
  });

  it("creates USA serializers by default", () => {
    const serializers = createSerializer({});
    const result = serializers.money.stringify(1000);
    expect(result).toContain("$");
  });

  it("creates EU Serializers with EU region", () => {
    const Serializers = createSerializer({ regionFormat: "eu" });
    const result = Serializers.money.stringify(1000);
    expect(result).toContain("€");
  });

  it("ignores unknown regions and defaults to US", () => {
    const Serializers = createSerializer({ regionFormat: "XX" as any });
    const result = Serializers.money.stringify(1000);
    expect(result).toContain("$");
  });

  it("returns different Serializer instances", () => {
    const usa = createSerializer({ regionFormat: "us" });
    const eu = createSerializer({ regionFormat: "eu" });

    const moneyTest = { amount: 100, currency: "USD" };
    const usaResult = usa.money.stringify(moneyTest);
    const euResult = eu.money.stringify(moneyTest);

    expect(usaResult).not.toBe(euResult);
  });
});

describe("custom Serializers", () => {
  it("allows implementing custom SerializerRegistry", () => {
    const customSerializers: SerializerRegistry = {
      money: {
        stringify: (value) => `CUSTOM: ${JSON.stringify(value)}`,
      },
      address: {
        stringify: (value) =>
          `CUSTOM ADDRESS: ${(value as any)?.line1 || "unknown"}`,
      },
      phone: {
        stringify: (value) =>
          `CUSTOM PHONE: ${(value as any)?.number || "unknown"}`,
      },
      person: {
        stringify: (value) =>
          `CUSTOM PERSON: ${(value as any)?.name || "unknown"}`,
      },
      organization: {
        stringify: (value) =>
          `CUSTOM ORG: ${(value as any)?.name || "unknown"}`,
      },
      party: {
        stringify: (value) => `CUSTOM PARTY: ${JSON.stringify(value)}`,
      },
      coordinate: {
        stringify: (value) => `CUSTOM COORDINATE: ${JSON.stringify(value)}`,
      },
      bbox: {
        stringify: (value) => `CUSTOM BBOX: ${JSON.stringify(value)}`,
      },
      duration: {
        stringify: (value) => `CUSTOM DURATION: ${value}`,
      },
      identification: {
        stringify: (value) => `CUSTOM ID: ${JSON.stringify(value)}`,
      },
      attachment: {
        stringify: (value) => `CUSTOM ATTACHMENT: ${JSON.stringify(value)}`,
      },
      signature: {
        stringify: (value) => `CUSTOM SIGNATURE: ${JSON.stringify(value)}`,
      },
    };

    expect(
      customSerializers.money.stringify({ amount: 100, currency: "USD" })
    ).toContain("CUSTOM");
    expect(
      customSerializers.address.stringify({ line1: "123 Main" })
    ).toContain("CUSTOM ADDRESS");
  });

  it("allows passing custom Serializers to renderers via context", () => {
    const customSerializers: SerializerRegistry = {
      money: { stringify: () => "CUSTOM_MONEY" },
      address: { stringify: () => "CUSTOM_ADDRESS" },
      phone: { stringify: () => "CUSTOM_PHONE" },
      person: { stringify: () => "CUSTOM_PERSON" },
      organization: { stringify: () => "CUSTOM_ORG" },
      party: { stringify: () => "CUSTOM_PARTY" },
      coordinate: { stringify: () => "CUSTOM_COORDINATE" },
      bbox: { stringify: () => "CUSTOM_BBOX" },
      duration: { stringify: () => "CUSTOM_DURATION" },
      identification: { stringify: () => "CUSTOM_ID" },
      attachment: { stringify: () => "CUSTOM_ATTACHMENT" },
      signature: { stringify: () => "CUSTOM_SIGNATURE" },
    };

    const result = customSerializers.money.stringify(1000);
    expect(result).toBe("CUSTOM_MONEY");
  });

  it("allows mixing Serializer implementations", () => {
    const hybridSerializers: SerializerRegistry = {
      money: usaSerializers.money,
      address: euSerializers.address,
      phone: {
        stringify: () => "E.164 Format",
      },
      person: usaSerializers.person,
      organization: usaSerializers.organization,
      party: {
        stringify: (value) => `Party: ${JSON.stringify(value)}`,
      },
      coordinate: usaSerializers.coordinate,
      bbox: usaSerializers.bbox,
      duration: usaSerializers.duration,
      identification: usaSerializers.identification,
      attachment: usaSerializers.attachment,
      signature: usaSerializers.signature,
    };

    expect(hybridSerializers.money.stringify(100)).toContain("$");
    expect(hybridSerializers.address.stringify(testAddress)).toContain("10001");
    expect(
      hybridSerializers.phone.stringify({ number: "+12125551234" } as any)
    ).toBe("E.164 Format");
  });

  it("allows creating locale-specific custom Serializers", () => {
    const ukSerializers: SerializerRegistry = {
      money: {
        stringify: (value) => {
          if (typeof value === "number") {
            return `£${value.toFixed(2)}`;
          }
          const amount = (value as Money).amount ?? 0;
          return `£${amount.toFixed(2)}`;
        },
      },
      address: {
        stringify: (value) => {
          const parts: string[] = [];
          if (value.line1) parts.push(value.line1);
          if (value.postalCode) parts.push(value.postalCode);
          if (value.locality) parts.push(value.locality);
          if (value.country) parts.push(value.country);
          return parts.join(", ");
        },
      },
      phone: {
        stringify: (value) => {
          if (typeof value === "string") return value;
          return (value as Phone).number || "";
        },
      },
      person: usaSerializers.person,
      organization: usaSerializers.organization,
      party: {
        stringify: (value) => {
          if ("firstName" in value || "lastName" in value) {
            return ukSerializers.person.stringify(value as any);
          }
          if ("name" in value && !("firstName" in value)) {
            return ukSerializers.organization.stringify(value as any);
          }
          return "";
        },
      },
      coordinate: usaSerializers.coordinate,
      bbox: usaSerializers.bbox,
      duration: usaSerializers.duration,
      identification: usaSerializers.identification,
      attachment: usaSerializers.attachment,
      signature: usaSerializers.signature,
    };

    const result = ukSerializers.money.stringify(100);
    expect(result).toBe("£100.00");

    const addrResult = ukSerializers.address.stringify({
      line1: "10 Downing St",
      locality: "London",
      postalCode: "SW1A 2AA",
      country: "UK",
    });
    expect(addrResult).toContain("SW1A 2AA");
  });

  it("allows creating accessibility-focused Serializers", () => {
    const a11ySerializers: SerializerRegistry = {
      money: {
        stringify: (value) => {
          const amount =
            typeof value === "number" ? value : (value as Money).amount ?? 0;
          const currency =
            typeof value === "number"
              ? "USD"
              : (value as Money).currency || "USD";
          return `${amount} ${currency} dollars`;
        },
      },
      address: {
        stringify: (value) => {
          const parts: string[] = [];
          if (value.line1) parts.push(`Street: ${value.line1}`);
          if (value.line2) parts.push(`Unit: ${value.line2}`);
          if (value.locality) parts.push(`City: ${value.locality}`);
          if (value.region) parts.push(`State: ${value.region}`);
          if (value.postalCode) parts.push(`Zip: ${value.postalCode}`);
          if (value.country) parts.push(`Country: ${value.country}`);
          return parts.join(". ");
        },
      },
      phone: {
        stringify: (value) => {
          const number =
            typeof value === "string" ? value : (value as Phone).number || "";
          return `Phone: ${number}`;
        },
      },
      person: {
        stringify: (value) => {
          const parts: string[] = [];
          if (value.title) parts.push(value.title);
          if (value.firstName) parts.push(value.firstName);
          if (value.lastName) parts.push(value.lastName);
          return parts.join(" ");
        },
      },
      organization: {
        stringify: (value) => {
          return (value as Organization).name || "";
        },
      },
      party: {
        stringify: (value) => {
          if ("firstName" in value || "lastName" in value) {
            return a11ySerializers.person.stringify(value as any);
          }
          return a11ySerializers.organization.stringify(value as any);
        },
      },
      coordinate: usaSerializers.coordinate,
      bbox: usaSerializers.bbox,
      duration: usaSerializers.duration,
      identification: usaSerializers.identification,
      attachment: usaSerializers.attachment,
      signature: usaSerializers.signature,
    };

    expect(a11ySerializers.money.stringify(50)).toBe("50 USD dollars");
    const a11yAddress = a11ySerializers.address.stringify({
      line1: "123 Main St",
      locality: "Boston",
    });
    expect(a11yAddress).toContain("Street: 123 Main St");
    expect(a11yAddress).toContain("City: Boston");
  });
});
