---
name: fields
description: The 24 Paradoc field types. Properties per type, the exact fill value per type, SDK builders, and how to choose a type.
metadata:
  tags: fields, types, fill values, constraints, fieldset, list, enum, money, phone, datetime, builders
---

# Fields

**Contents:** [Common properties](#common-properties) · [Field Type Reference](#field-type-reference) · [Type-specific properties](#type-specific-properties) · [Design heuristics](#design-heuristics) · [SDK](#sdk) · [Add a field](#add-a-field)

A form's `fields` object maps each field id to a field definition. Field ids, nested ones included, are camelCase ([schemas.md § Identifier patterns](./schemas.md#identifier-patterns)). For `required` and `visible` expressions, load [logic.md](./logic.md).

## Common properties

Every field type takes these four, plus the properties its type lists below.

| Property | Type | Constraint |
|----------|------|------------|
| `type` | string | Required. One of the types in the table below. |
| `label` | string | 1-200 characters |
| `description` | string | 1-1000 characters |
| `required` | CondExpr | `true`, `false`, or a boolean expression string. Default: not required. |
| `visible` | CondExpr | Same. A hidden field is never required. |

`default` is not common. Each type that accepts one lists it, and `fieldset` and `list` accept none.

## Field Type Reference

Paradoc has 24 field types. The fill value column is the exact JSON a payload carries under `fields.<id>`.

| Type | Fill value | Use for |
|------|-----------|---------|
| `text` | string | Free text, names, notes |
| `boolean` | `true` or `false` | Yes/no, one checkbox |
| `number` | number | Counts, quantities |
| `money` | `{ "amount": 1500.5, "currency": "USD" }` | Prices, fees, salaries |
| `percentage` | number in percentage points (`8.25` is 8.25%) | Rates, ratios |
| `rating` | number | Scores |
| `date` | `"2026-01-31"` (`YYYY-MM-DD`) | Calendar dates |
| `datetime` | `"2026-01-31T14:30:00Z"` (UTC, ends in `Z`) | Timestamps |
| `time` | `"14:30:00"` (`HH:MM:SS`, 24-hour) | Times of day |
| `duration` | `"P1Y"`, `"PT30M"` (ISO 8601) | Lease terms, warranties |
| `email` | `"jane@example.com"` | Email addresses |
| `phone` | `{ "number": "+14155552671", "type": "mobile" }` | Phone numbers |
| `address` | `{ "line1", "line2"?, "locality", "region", "postalCode", "country" }` | Postal addresses |
| `person` | `{ "name", "title"?, "firstName"?, "middleName"?, "lastName"?, "suffix"? }` | People |
| `organization` | `{ "name", "legalName"?, "domicile"?, "entityType"?, "entityId"?, "taxId"? }` | Companies |
| `identification` | `{ "type", "number", "issuer"?, "issueDate"?, "expiryDate"? }` | Passports, licenses, tax ids |
| `uuid` | `"123e4567-e89b-12d3-a456-426614174000"` | Unique identifiers |
| `uri` | `"https://example.com"` (absolute URL) | Links |
| `enum` | one option `value`, same JSON type (`2`, not `"2"`) | Single choice |
| `multiselect` | array of distinct option values | Multiple choice |
| `coordinate` | `{ "lat": 40.71, "lon": -74.0 }` | GPS points |
| `bbox` | `{ "southWest": { "lat", "lon" }, "northEast": { "lat", "lon" } }` | Geographic boxes |
| `fieldset` | object keyed by the nested field ids | Grouped sub-fields |
| `list` | array of `item` values | Repeating entries |

Object values are strict too: `{ "number": "+14155552671", "ext": "12" }` fails with `Unknown field(s): ext`.

## Type-specific properties

Each section lists the properties a type adds to the common ones, its fill value rules, and one example. `min` must be at most `max`, `minLength` at most `maxLength`, and `minItems` at most `maxItems`. Validation reports `max must be greater than or equal to min`.

#### text, uuid, uri

| Property | Type | Description |
|----------|------|-------------|
| `minLength` | number | Minimum length |
| `maxLength` | number | Maximum length |
| `pattern` | string | Regular expression, 1-500 characters. A pattern open to catastrophic backtracking is refused. |
| `default` | string | Default value |

A `uuid` value must be a UUID. A `uri` value must be an absolute URL (`x.co` fails with `Invalid URL format`).

```json schema=fields
"fullName": { "type": "text", "label": "Full legal name", "required": true, "minLength": 2, "maxLength": 100 },
"ssn": { "type": "text", "label": "SSN", "pattern": "^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$" }
```

#### email

| Property | Type | Description |
|----------|------|-------------|
| `minLength` | number | Minimum length |
| `maxLength` | number | Maximum length |
| `default` | string | Default value |

The type checks the address format itself, so email takes no `pattern`.

#### boolean

| Property | Type | Description |
|----------|------|-------------|
| `default` | boolean | Default value |

```json schema=fields
"agreeToTerms": { "type": "boolean", "label": "I agree to the terms", "required": true, "default": false }
```

#### number

| Property | Type | Description |
|----------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `step` | number > 0 | A value must be a multiple of it. `0.01` allows cents; `1.234` then fails. |
| `default` | number | Default value |

#### money

| Property | Type | Description |
|----------|------|-------------|
| `min` | number | Minimum `amount` |
| `max` | number | Maximum `amount` |
| `currency` | string | ISO 4217 code (`^[A-Z]{3}$`) every value must use. Omit to accept any currency. |
| `default` | `{ amount, currency }` | Default value |

`amount` is a JSON number (`"10"` fails). With `currency: "USD"`, `{ "amount": 10, "currency": "EUR" }` fails with `expected USD`. Expressions read `fields.x.amount` ([logic.md § Money](./logic.md#money)).

```json schema=fields
"monthlyRent": { "type": "money", "label": "Monthly rent", "required": true, "min": 0, "currency": "USD" }
```

#### percentage

| Property | Type | Description |
|----------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value |
| `precision` | number | Descriptive only. Fill and render do not use it. |
| `default` | number | Default value |

A percentage has no implied range: without bounds, `150` is accepted. Set `min: 0` and `max: 100` when the value is a share of a whole.

```json schema=fields
"interestRate": { "type": "percentage", "label": "Interest rate", "min": 0, "max": 100 }
```

#### rating

| Property | Type | Description |
|----------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value. Also the scale the formatter prints ("4 of 5"). |
| `step` | number | A value must be a multiple of it (`0.5` for half stars) |
| `default` | number | Default value |

A rating has no implied range. Set `min` and `max`; without `max` a rendered rating prints as a plain number.

```json schema=fields
"satisfaction": { "type": "rating", "label": "Satisfaction", "min": 1, "max": 5, "step": 1 }
```

#### date, datetime, time

| Property | Type | Description |
|----------|------|-------------|
| `min` | string | Earliest value, same format as the fill value |
| `max` | string | Latest value, same format as the fill value |
| `default` | string | Default value |

| Type | Accepted | Refused |
|------|----------|---------|
| `date` | `2026-01-31` | `2026-1-31` |
| `datetime` | `2026-01-31T14:30:00Z`, `2026-01-31T14:30:00.123Z` | `2026-01-31T14:30:00+02:00`, `2026-01-31T14:30:00` (`Invalid ISO datetime`) |
| `time` | `14:30:00` | `14:30`, `14:30:00.5`, `24:00:00` |

Convert a local datetime to UTC before you fill it.

```json schema=fields
"dateOfBirth": { "type": "date", "label": "Date of birth", "required": true, "max": "2008-01-01" },
"appointment": { "type": "datetime", "label": "Appointment", "min": "2026-01-01T00:00:00Z" }
```

#### duration

| Property | Type | Description |
|----------|------|-------------|
| `default` | string | Default value |

The value is `P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S` with at least one component: `P1Y`, `P2W`, `P1DT12H`, `PT30M`. `P` alone fails.

#### enum

| Property | Type | Description |
|----------|------|-------------|
| `enum` | `{ value: string \| number, label?: string }[]` | Required. At least one option. `label` is 1-200 characters. |
| `default` | string or number | Must equal one option's `value` |

Fill with the option's `value`, not its label. The JSON type must match: with `{ "value": 2 }`, `"2"` fails.

```json schema=fields
"employmentStatus": {
  "type": "enum",
  "label": "Employment status",
  "required": true,
  "enum": [
    { "value": "employed", "label": "Employed" },
    { "value": "self_employed", "label": "Self-employed" },
    { "value": "retired", "label": "Retired" }
  ]
}
```

#### multiselect

| Property | Type | Description |
|----------|------|-------------|
| `enum` | `{ value, label? }[]` | Required. At least one option. |
| `min` | number | Minimum number of selections |
| `max` | number | Maximum number of selections |
| `default` | `(string \| number)[]` | Default selections |

Fill with an array of option values. Duplicates fail with `Array items must be unique`.

```json schema=fields
"services": {
  "type": "multiselect",
  "label": "Services",
  "min": 1,
  "enum": [{ "value": "plumbing", "label": "Plumbing" }, { "value": "wiring", "label": "Wiring" }]
}
```

#### phone

| Property | Type | Description |
|----------|------|-------------|
| `default` | phone object | Default value |

`number` is E.164: `+`, country code, subscriber number, no spaces (`^\+[1-9]\d{1,14}$`). `"555-1234"` fails. `type` is optional and is one of `mobile`, `work`, `home`.

#### address

| Property | Type | Description |
|----------|------|-------------|
| `default` | address object | Default value |

`line1`, `locality`, `region`, `postalCode` and `country` are required; `line2` is optional. `country` is an ISO 3166-1 code (`US`, `GB`) or a country name. A `default` is checked against the schema: `postalCode` 3-20 characters of `A-Z`, digits, spaces and hyphens.

```json schema=fields
"propertyAddress": {
  "type": "address",
  "label": "Property address",
  "default": { "line1": "10 Main St", "locality": "Springfield", "region": "IL", "postalCode": "62701", "country": "US" }
}
```

#### person, organization

| Property | Type | Description |
|----------|------|-------------|
| `default` | person or organization object | Default value |

`name` is required on both. A person also takes `title`, `firstName`, `middleName`, `lastName` and `suffix`. An organization also takes `legalName`, `domicile`, `entityType`, `entityId` and `taxId`. For the people who sign, use a party role instead; see [parties.md](./parties.md).

#### identification

| Property | Type | Description |
|----------|------|-------------|
| `allowedTypes` | string[] | The values the fill value's `type` may take |
| `default` | identification object | Default value |

`type` and `number` are required. `issueDate` and `expiryDate` are `YYYY-MM-DD`. With `allowedTypes: ["passport"]`, `{ "type": "ssn", ... }` fails with `Must be one of: passport`.

```json schema=fields
"governmentId": { "type": "identification", "label": "Government ID", "allowedTypes": ["passport", "drivers_license"] }
```

#### coordinate, bbox

| Property | Type | Description |
|----------|------|-------------|
| `default` | coordinate or bbox object | Default value |

`lat` is -90 to 90 and `lon` is -180 to 180, in decimal degrees. A bbox has `southWest` (minimum) and `northEast` (maximum) corners.

#### fieldset

| Property | Type | Description |
|----------|------|-------------|
| `fields` | object | Required. Nested field definitions, any type, including `fieldset` and `list`. |

The fill value is an object keyed by the declared nested ids. Group three or more closely related fields that render under one heading (a previous address, an emergency contact); keep one or two unrelated fields flat.

```json schema=fields
"emergencyContact": {
  "type": "fieldset",
  "label": "Emergency contact",
  "fields": {
    "name": { "type": "text", "label": "Name", "required": true },
    "relationship": { "type": "text", "label": "Relationship" },
    "phone": { "type": "phone", "label": "Phone", "required": true }
  }
}
```

Fill value: `{ "emergencyContact": { "name": "Ann Lee", "phone": { "number": "+14155552671" } } }`.

#### list

| Property | Type | Description |
|----------|------|-------------|
| `item` | field | Required. The definition of each entry, any type. |
| `minItems` | integer ≥ 0 | Minimum entries |
| `maxItems` | integer ≥ 0 | Maximum entries |

The fill value is an array of `item` values. To total or test rows in an expression, load [logic.md § List aggregates](./logic.md#list-aggregates).

```json schema=fields
"dependents": {
  "type": "list",
  "label": "Dependents",
  "maxItems": 4,
  "item": {
    "type": "fieldset",
    "fields": {
      "name": { "type": "text", "label": "Name", "required": true },
      "dateOfBirth": { "type": "date", "label": "Date of birth" }
    }
  }
}
```

Fill value: `{ "dependents": [{ "name": "Kim", "dateOfBirth": "2019-04-02" }] }`.

## Design heuristics

### Type selection table

| Data | Use | Not |
|------|-----|-----|
| Prices, fees, rent, salaries | `money` | `number`, `text` |
| Calendar dates | `date` | `text` |
| Date and time of an event | `datetime` | `text` |
| Time of day | `time` | `text` |
| Periods (lease term, warranty) | `duration` | `text`, `number` |
| Yes/no, one checkbox | `boolean` | `enum`, `text` |
| One choice from a list | `enum` | `text` |
| Several choices from a list | `multiselect` | `text` |
| Counts, quantities | `number` | `text` |
| Rates, ratios | `percentage` | `number` |
| Scores | `rating` | `number` |
| Email addresses | `email` | `text` |
| Phone numbers | `phone` | `text` |
| Postal addresses | `address` | `text`, several `text` fields |
| A person's name parts | `person` | `text` |
| Company details | `organization` | `text` |
| Passports, licenses, SSN, EIN | `identification` or `text`+`pattern` | bare `text` |
| URLs | `uri` | `text` |
| System identifiers | `uuid` | `text` |
| GPS points | `coordinate` | `text` |
| Geographic areas | `bbox` | `text` |
| Related sub-fields under one heading | `fieldset` | several top-level fields |
| Repeating rows (dependents, line items) | `list` | numbered fields (`child1`, `child2`) |
| Free prose, notes, odd reference numbers | `text` | none |

### Naming by domain

| Domain | Example ids |
|--------|-------------|
| Personal | `firstName`, `lastName`, `dateOfBirth`, `email`, `phone` |
| Financial | `annualIncome`, `monthlyExpenses`, `loanAmount` |
| Employment | `employerName`, `jobTitle`, `startDate`, `annualSalary` |
| Property | `propertyAddress`, `monthlyRent`, `securityDeposit`, `leaseStartDate` |
| Medical | `primaryPhysician`, `allergies`, `medications`, `insuranceProvider` |

Name the thing, not the kind: `monthlyRent`, not `amount`; `leaseStartDate`, not `date`.

### Patterns for common identifiers

| Identifier | Pattern |
|------------|---------|
| SSN | `^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$` |
| EIN | `^[0-9]{2}-?[0-9]{7}$` |
| US ZIP | `^[0-9]{5}(-[0-9]{4})?$` |

### Order and progressive disclosure

Fields render in definition order: identity, contact, domain data, conditional fields, consent. Gate a follow-up field on a boolean condition:

```json schema=fields
"hasPets": { "type": "boolean", "label": "Do you have pets?", "default": false },
"petCount": {
  "type": "number",
  "label": "Number of pets",
  "visible": "fields.hasPets == true",
  "required": "fields.hasPets == true",
  "min": 1,
  "max": 10
}
```

## SDK

The builder chain takes field builders, plain objects, or a mix, and validates each field at `build()`. `p.form({ ... })` takes plain objects only ([sdk.md § Define an artifact](./sdk.md#define-an-artifact)).

```typescript
import { p } from "@paradoc/sdk";

const builtForm = p
  .form()
  .name("intake")
  .fields({
    fullName: p.field.text().label("Full name").required().maxLength(100),
    status: p.field.enum().options([{ value: "new" }, { value: "returning" }]),
    deposit: { type: "money", currency: "USD" },
  })
  .build();
```

### Field builder methods

`p.field.<type>()` exists for all 24 types. Every builder has `.label()`, `.description()`, `.required(cond = true)`, `.visible(cond = true)` and `.build()`. Every type except `fieldset` and `list` has `.default(value)`. The type-specific methods mirror the properties above:

<!-- dep:C6 -->
| Builder | Methods |
|---------|---------|
| `text`, `uuid`, `uri` | `.minLength(n)`, `.maxLength(n)`, `.pattern(re)` |
| `email` | `.minLength(n)`, `.maxLength(n)` |
| `number` | `.min(n)`, `.max(n)`, `.step(n)` |
| `money` | `.min(n)`, `.max(n)`, `.currency(code)` |
| `percentage` | `.min(n)`, `.max(n)`, `.precision(n)` |
| `rating` | `.min(n)`, `.max(n)`, `.step(n)` |
| `date`, `datetime`, `time` | `.min(s)`, `.max(s)` |
| `enum` | `.options([{ value, label? }])` |
| `multiselect` | `.options([...])`, `.min(n)`, `.max(n)` |
| `identification` | `.allowedTypes(...types)` |
| `fieldset` | `.field(id, def)`, `.fields({ ... })` |
| `list` | `.item(def)`, `.minItems(n)`, `.maxItems(n)` |

## Add a field

1. Choose a camelCase id that names the thing: `monthlyRent`, not `amount`.
2. Pick the type from the [type selection table](#type-selection-table).
3. Add `label`, the type's constraints, and `required`/`visible` if needed.
4. Run `npx paradoc-cli validate <file>`. The field is done when it exits 0 and reports no issues.
5. Print a starting payload with `npx paradoc-cli data template <file> --json --out data.json`. Give every required field a value, put a real value in the new field, and run `npx paradoc-cli data validate <file> data.json`. It exits 0 when the payload is complete and each value has the right shape.

## See also

- [annexes.md](./annexes.md): when the form collects a file, not a value
- [filling.md](./filling.md): when you fill or change a draft
- [formatting.md](./formatting.md): when you control how values print
