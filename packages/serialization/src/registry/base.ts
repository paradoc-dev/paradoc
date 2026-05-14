/**
 * Base Registry Factory
 * Creates region-specific serializer registries with minimal duplication.
 */

import type {
  Money,
  Address,
  Person,
  Organization,
  Party,
} from "@paradoc/types";
import type { SerializerRegistry } from "@paradoc/types";
import {
  phoneStringifier,
  personStringifier,
  organizationStringifier,
  coordinateStringifier,
  bboxStringifier,
  durationStringifier,
  identificationStringifier,
  attachmentStringifier,
  signatureStringifier,
} from "../serializers";
import { assertMoney } from "../serializers/money";
import { assertAddress } from "../serializers/address";
import { assertParty } from "../serializers/party";

type AddressFormat = "us" | "eu";

interface RegionConfig {
  locale: string;
  defaultCurrency: string;
  addressFormat: AddressFormat;
}

const createMoneyStringifier = (locale: string, defaultCurrency: string) => ({
  stringify(value: Money | number | Partial<Money>): string {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Invalid number");
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: defaultCurrency,
      }).format(value);
    }

    assertMoney(value);

    const { amount, currency = defaultCurrency } = value as Money;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  },
});

const createAddressStringifier = (format: AddressFormat) => ({
  stringify(value: Address | Partial<Address>): string {
    assertAddress(value);

    const parts: string[] = [];

    if (value.line1) parts.push(value.line1);
    if (value.line2) parts.push(value.line2);

    const locationParts: string[] = [];
    if (format === "eu") {
      // EU: postal code first, then locality, region
      if (value.postalCode) locationParts.push(value.postalCode);
      if (value.locality) locationParts.push(value.locality);
      if (value.region) locationParts.push(value.region);
    } else {
      // US/Intl: locality, region, postal code
      if (value.locality) locationParts.push(value.locality);
      if (value.region) locationParts.push(value.region);
      if (value.postalCode) locationParts.push(value.postalCode);
    }

    if (locationParts.length > 0) {
      const separator = format === "eu" ? " " : ", ";
      parts.push(locationParts.join(separator));
    }

    if (value.country) parts.push(value.country);

    return parts.join(", ");
  },
});

const createPartyStringifier = (registry: SerializerRegistry) => ({
  stringify(value: Party | Partial<Party>): string {
    assertParty(value);

    if ("firstName" in value || "lastName" in value) {
      return registry.person.stringify(value as Person | Partial<Person>);
    }

    if ("name" in value && !("firstName" in value)) {
      return registry.organization.stringify(
        value as Organization | Partial<Organization>
      );
    }

    throw new Error("Invalid party: must be either a Person or Organization");
  },
});

export function createRegionRegistry(config: RegionConfig): SerializerRegistry {
  const registry: SerializerRegistry = {
    money: createMoneyStringifier(config.locale, config.defaultCurrency),
    address: createAddressStringifier(config.addressFormat),
    phone: phoneStringifier,
    person: personStringifier,
    organization: organizationStringifier,
    party: null as never, // Placeholder, set below
    coordinate: coordinateStringifier,
    bbox: bboxStringifier,
    duration: durationStringifier,
    identification: identificationStringifier,
    attachment: attachmentStringifier,
    signature: signatureStringifier,
  };

  // Party needs reference to the registry for delegation
  registry.party = createPartyStringifier(registry);

  return registry;
}

// Pre-configured registries
export const usaSerializers = createRegionRegistry({
  locale: "en-US",
  defaultCurrency: "USD",
  addressFormat: "us",
});

export const euSerializers = createRegionRegistry({
  locale: "de-DE",
  defaultCurrency: "EUR",
  addressFormat: "eu",
});
