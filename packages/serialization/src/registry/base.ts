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
import type { RegionFormat, SerializerRegistry } from "@paradoc/types";
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
import { assertDate, toDate } from "../serializers/date";
import { assertDatetime, toDatetime } from "../serializers/datetime";
import { assertTime, toTimeOfDay } from "../serializers/time";
import { assertNumberValue } from "../serializers/number";
import { assertPercentageValue } from "../serializers/percentage";

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

const createDateStringifier = (locale: string) => ({
  stringify(value: string | Date): string {
    assertDate(value);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(toDate(value));
  },
});

const createDatetimeStringifier = (locale: string) => ({
  stringify(value: string | Date): string {
    assertDatetime(value);
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(toDatetime(value));
  },
});

const createTimeStringifier = (locale: string) => ({
  stringify(value: string): string {
    assertTime(value);
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(toTimeOfDay(value));
  },
});

const createNumberStringifier = (locale: string) => ({
  stringify(value: number): string {
    assertNumberValue(value);
    return new Intl.NumberFormat(locale).format(value);
  },
});

const createPercentageStringifier = (locale: string) => ({
  stringify(value: number): string {
    assertPercentageValue(value);
    return `${new Intl.NumberFormat(locale).format(value)}%`;
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
    date: createDateStringifier(config.locale),
    datetime: createDatetimeStringifier(config.locale),
    time: createTimeStringifier(config.locale),
    number: createNumberStringifier(config.locale),
    percentage: createPercentageStringifier(config.locale),
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

/**
 * Arabic-language formatting, with Western digits.
 *
 * **The numbering system is pinned, and that is the decision this registry
 * makes.** `ar` alone would leave the digits to the runtime's CLDR data, which
 * has changed which system it defaults to between ICU releases; a registry
 * whose output moves with the runtime is not deterministic, which is the one
 * property every registry here holds. So the tag carries `-u-nu-latn` and the
 * digits are `0123456789` on every machine.
 *
 * **Latin digits rather than Arabic-Indic (`٠١٢٣`) is a choice, not a
 * limitation.** Both are correct Arabic; which one a document uses is
 * regional. Contracts, invoices and statements across the Gulf and the Levant
 * are set in Western digits, Egypt and Sudan in Arabic-Indic, and a registry
 * has to pick one. Western digits also survive a PDF's text layer intact,
 * where the shaped Arabic around them does not, so a reader can still search a
 * rendered document for an amount or a reference number.
 *
 * A document that needs Arabic-Indic digits has no registry here yet. It is
 * `ar-u-nu-arab` and one more entry; nothing in the design prevents it, and
 * nothing in this program needed it.
 *
 * The address order is the US/international one — street, locality, region,
 * postal code — which is what Arabic postal addresses use; only the language
 * of the words differs, and those come from the data.
 */
export const arSerializers = createRegionRegistry({
  locale: "ar-u-nu-latn",
  defaultCurrency: "SAR",
  addressFormat: "us",
});

/**
 * Every built-in registry, by the name a caller asks for it by.
 *
 * One map, exported, because every consumer that lets a document choose a
 * registry needs exactly this and a second copy would be a second list to keep
 * in step. `satisfies` makes it exhaustive: a `RegionFormat` added without an
 * entry here fails to compile, so nothing can select a registry that does not
 * exist and no caller needs a fallback for one.
 */
export const REGION_REGISTRIES = {
  us: usaSerializers,
  eu: euSerializers,
  ar: arSerializers,
} satisfies Record<RegionFormat, SerializerRegistry>;
