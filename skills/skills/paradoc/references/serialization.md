---
name: serialization
description: Locale-aware string formatting for Money, Address, Phone, Person, and other primitives via @paradoc/serialization
metadata:
  tags: serialization, money, address, phone, person, locale, formatting, regionFormat
---

# Serialization

`@paradoc/serialization` converts Paradoc primitive types into human-readable strings with locale awareness. Used internally by renderers when a form schema is provided; can also be used directly.

## Installation

```bash
npm install @paradoc/serialization
```

## Pre-built Serializers

```typescript
import { usaSerializers } from "@paradoc/serialization";

usaSerializers.money.stringify({ amount: 1500, currency: "USD" });
// => "$1,500.00"

usaSerializers.address.stringify({
  line1: "123 Main St",
  locality: "New York",
  region: "NY",
  postalCode: "10001",
  country: "USA",
});
// => "123 Main St, New York, NY, 10001, USA"

usaSerializers.person.stringify({ name: "Jane Smith" });
// => "Jane Smith"
```

## Factory Function

```typescript
import { createSerializer } from "@paradoc/serialization";

const serializers = createSerializer({ regionFormat: "us" });
// regionFormat: "us" | "eu" | ...
```

## Available Stringifiers

| Type | Input | Output Example |
|------|-------|---------------|
| `money` | `Money \| number` | `$1,500.00` |
| `address` | `Address` | `123 Main St, New York, NY, 10001, USA` |
| `phone` | `Phone \| string` | `(555) 123-4567` |
| `person` | `Person` | `Jane Smith` |
| `organization` | `Organization` | `Acme Corp` |
| `party` | `Person \| Organization` | Auto-detects type |
| `coordinate` | `Coordinate` | `40.7128,-74.0060` |
| `bbox` | `Bbox` | `40.70,-74.02,40.73,-73.97` |
| `duration` | `Duration \| string` | ISO 8601 formatted |
| `identification` | `Identification` | Type + number + issuer |
| `attachment` | `Attachment` | Filename + content type |
| `signature` | `Signature` | Signature status |

## Fallbacks

Configure fallback values for null / invalid data. Default fallback is empty string `""`.

```typescript
const serializers = createSerializer({
  regionFormat: "us",
  fallbacks: {
    money: "N/A",
    address: "Address not available",
    phone: "-",
    person: "Unknown",
  },
});

serializers.money.stringify(null);
// => "N/A"
```

## Custom Serializers

Implement `SerializerRegistry` for custom formatting:

```typescript
import type { SerializerRegistry } from "@paradoc/serialization";

const custom: SerializerRegistry = {
  money: {
    stringify: (value) => {
      const amount = typeof value === "number" ? value : value.amount ?? 0;
      return `EUR ${amount.toFixed(2)}`;
    },
  },
  // ... other serializers
};
```

## Using with Renderers

Pass serializers to any renderer (text, PDF, DOCX):

```typescript
import { textRenderer } from "@paradoc/renderer-text";

const output = await form.fill(data).render({
  renderer: textRenderer({ serializers: mySerializers }),
  layer: "markdown",
  resolver,
});
```

## See Also

- [rendering.md](./rendering.md) — renderer integration
- [fields.md](./fields.md) — which field types get serialized
