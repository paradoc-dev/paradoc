<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=serialization" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/serialization</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=serialization)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=serialization) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Locale and region-aware serialization of Paradoc primitive types (Money, Address, Phone, Person, Organization) into human-readable string representations.

- **Multi-locale support** - USA, EU, and international serializers built-in
- **Pluggable architecture** - Implement custom serializers via `SerializerRegistry` interface
- **Accessibility-ready** - Simple patterns for screen reader and accessibility-focused formatting
- **Type-safe** - Full TypeScript support

## Installation

```bash
npm install @paradoc/serialization
```

## Usage

### Using Pre-built Serializers

Import a pre-configured serializer and use them directly:

```typescript
import { usaSerializers } from "@paradoc/serialization";

// USA serializers (default - uses USD, US address format, formatted phone)
usaSerializers.money.stringify({ amount: 1500, currency: "USD" });
// → "$1,500.00"

usaSerializers.address.stringify({
  line1: "123 Main St",
  locality: "New York",
  region: "NY",
  postalCode: "10001",
  country: "USA",
});
// → "123 Main St, New York, NY, 10001, USA"
```

### Using the factory function

Create serializer instances with specific regional configurations:

```typescript
import { createSerializer } from "@paradoc/serialization";

// Create serializers for different regions
const usaSerializers = createSerializer({ regionFormat: "us" });

// Use them to serialize data
const price = usaSerializers.money.stringify({
  amount: 99.99,
  currency: "USD",
});
// -> "$99.99"
```

### Configuring Fallbacks

Configure fallback values that are used when serialization fails (e.g., when data is null or invalid). The default is an empty string ("").

```typescript
import { createSerializer } from "@paradoc/serialization";

const serializers = createSerializer({
  regionFormat: "us",
  fallbacks: {
    money: "N/A",
    address: "Address not available",
    phone: "–",
    person: "Unknown person",
    organization: "Unnamed organization",
    party: "Unknown party",
    coordinate: "No coordinates",
    bbox: "No bounds",
    duration: "No duration",
    identification: "No ID",
  },
});

// When serialization fails, the configured fallback is returned
serializers.money.stringify(null);
// → "N/A"

serializers.address.stringify(null);
// → "Address not available"
```

If no fallback is configured for a serializer type, an empty string is used by default:

```typescript
const serializers = createSerializer({ regionFormat: "us" });

serializers.money.stringify(null);
// → ""
```

### Serializer Registry API

Each serializer registry provides these stringifiers:

| Type             | Stringifier Signature                                          | Returns  | Description                                                                   |
| ---------------- | -------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `money`          | `stringify(Money \| number \| Partial<Money>): string`         | `string` | Serializes monetary amounts with currency symbol and locale-specific grouping |
| `address`        | `stringify(Address \| Partial<Address>): string`               | `string` | Serializes addresses with region-appropriate ordering and punctuation         |
| `phone`          | `stringify(Phone \| string \| Partial<Phone>): string`         | `string` | Serializes phone numbers in E.164 format                                      |
| `person`         | `stringify(Person \| Partial<Person>): string`                 | `string` | Serializes person names from full name or name components                     |
| `organization`   | `stringify(Organization \| Partial<Organization>): string`     | `string` | Serializes organization names with optional tax ID or identifier              |
| `party`          | `stringify(Party \| Partial<Party>): string`                   | `string` | Serializes either a person or organization (automatically detects type)       |
| `coordinate`     | `stringify(Coordinate \| Partial<Coordinate>): string`         | `string` | Serializes geographic coordinates as "lat,lon"                                |
| `bbox`           | `stringify(Bbox \| Partial<Bbox>): string`                     | `string` | Serializes bounding boxes as "swLat,swLon,neLat,neLon"                        |
| `duration`       | `stringify(Duration \| string): string`                        | `string` | Serializes ISO 8601 durations (e.g., "P1Y", "PT30M")                          |
| `identification` | `stringify(Identification \| Partial<Identification>): string` | `string` | Serializes identification documents with type, number, and issuer info        |

### Custom Serializers

Implement the `SerializerRegistry` interface to create custom serializers:

```typescript
import type { SerializerRegistry } from "@paradoc/serialization";

const customSerializers: SerializerRegistry = {
  money: {
    stringify: (value) => {
      const amount = typeof value === "number" ? value : value.amount ?? 0;
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

  // ... other serializers (phone, person, organization, party, coordinate, bbox, duration, identification)
};

// Use custom serializers
customSerializers.money.stringify(100);
// → "$100.00"

customSerializers.address.stringify({
  line1: "123 Main St",
  locality: "Boston",
  country: "USA",
});
// → "123 Main St, Boston, USA"
```

**Note:** Stringifiers do not accept a fallback parameter. Fallback handling is configured at factory creation time using the `createSerializer()` function with the `fallbacks` option.

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/serialization/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
