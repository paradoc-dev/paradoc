/**
 * Serializer Registry Interface
 *
 * Defines the contract for serializing primitive types to strings.
 * This interface is implemented by locale/region-specific serializers.
 */

import type {
  Money,
  Address,
  Phone,
  Person,
  Organization,
  Coordinate,
  Bbox,
  Duration,
  Identification,
  Attachment,
  Signature,
} from "../schemas/primitives";
import type { Party } from "../runtime";

/**
 * Fallback values for serializers when serialization fails
 */
export interface SerializerFallbacks {
  money?: string;
  address?: string;
  phone?: string;
  person?: string;
  organization?: string;
  party?: string;
  coordinate?: string;
  bbox?: string;
  duration?: string;
  identification?: string;
  attachment?: string;
  signature?: string;
}

/**
 * Configuration options for creating region-specific serializers.
 */
export interface SerializerConfig {
  /** Regional format preference. Determines address/phone/money formatting patterns. */
  regionFormat?: "us" | "eu";
  /** Fallback values for each serializer type when serialization fails. Defaults to empty string if not specified. */
  fallbacks?: SerializerFallbacks;
}

/**
 * Stringifier interface for a single type.
 * Converts validated data to string, using configured fallback if validation fails.
 */
export interface Stringifier<T> {
  stringify(value: T): string;
}

/**
 * Registry of stringifier namespaces for Paradoc primitive types.
 * Implement this interface to provide custom serialization logic.
 *
 * Usage:
 *   const config: SerializerConfig = {
 *     regionFormat: 'US',
 *     fallbacks: { money: 'N/A', address: '–' }
 *   }
 *   const registry = createSerializer(config);
 *
 *   registry.money.stringify({ amount: 100, currency: 'USD' })
 *   // Uses 'N/A' as fallback if serialization fails
 *   registry.address.stringify({ line1: '123 Main St', ... })
 *   // Uses '–' as fallback if serialization fails
 */
export interface SerializerRegistry {
  money: Stringifier<Money | number | Partial<Money>>;
  address: Stringifier<Address | Partial<Address>>;
  phone: Stringifier<Phone | string | Partial<Phone>>;
  person: Stringifier<
    | Person
    | Partial<Person>
    | {
        name?: string;
        title?: string;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        suffix?: string;
      }
  >;
  organization: Stringifier<Organization | Partial<Organization>>;
  party: Stringifier<Party | Partial<Party>>;
  coordinate: Stringifier<Coordinate | Partial<Coordinate>>;
  bbox: Stringifier<Bbox | Partial<Bbox>>;
  duration: Stringifier<Duration | string>;
  identification: Stringifier<Identification | Partial<Identification>>;
  attachment: Stringifier<Attachment | Partial<Attachment>>;
  signature: Stringifier<Signature | Partial<Signature>>;
}
