---
name: fields
description: All 23 Paradoc field types — JSON shape, SDK builders, identifier rules, constraints, fieldsets, design heuristics
metadata:
  tags: fields, types, identifier, constraints, fieldset, enum, money, address
---

# Fields

**Contents:** [Identifier rules](#field-identifier-rules) · [Common properties](#common-properties) · [Field type reference](#field-type-reference) · [Fieldsets](#fieldsets) · [Design heuristics](#design-heuristics)

Fields are the data-collection units of a form. Defined as a `fields` object — each key is a field identifier, each value is a field definition.

## Field Identifier Rules

- Pattern: `^[a-z][a-zA-Z0-9_]*$`
- MUST start with a lowercase letter
- May contain letters, digits, and underscores
- camelCase convention: `firstName`, `monthlyRent`, `hasPets`
- Max length: 100 characters

**Valid:** `monthlyRent`, `lease_id`, `propertyAddress`
**Invalid:** `MonthlyRent`, `123field`, `field-name`, `_private`

## Common Properties

All field types share:

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `type` | YES | string | One of the 23 field types below |
| `label` | No | string | Display label (max 200 chars) |
| `description` | No | string | Help text (max 1000 chars) |
| `required` | No | CondExpr | `true`, `false`, or expression string |
| `visible` | No | CondExpr | `true`, `false`, or expression string |
| `default` | No | varies | Default value (type depends on field) |

A `CondExpr` is a boolean literal OR an expression string. See [logic.md](./logic.md).

```json
"required": true
"required": "fields.employmentStatus == 'employed'"
"visible": "fields.hasPets == true"
```

## Field Type Reference

23 typed field definitions. ALWAYS use the most specific type — NEVER use `text` when a structured type fits.

| Type | Data Shape | Use For |
|------|-----------|---------|
| `text` | `string` | Free-text, names, notes |
| `boolean` | `boolean` | Yes/no, single checkbox |
| `number` | `number` | Quantities, counts |
| `money` | `{ amount, currency }` | Financial amounts |
| `percentage` | `number` (0-100) | Rates, ratios |
| `rating` | `number` | Scores, ratings |
| `date` | `string` (YYYY-MM-DD) | Dates |
| `datetime` | `string` (ISO 8601) | Timestamps |
| `time` | `string` (HH:MM:SS) | Times |
| `duration` | `string` (ISO 8601) | Time spans (P1Y, PT30M) |
| `email` | `string` | Email addresses |
| `phone` | `{ number, type?, extension? }` | Phone numbers |
| `address` | `{ line1, locality, region, postalCode, country }` | Postal addresses |
| `person` | `{ name, firstName?, lastName?, ... }` | People |
| `organization` | `{ name, legalName?, taxId?, ... }` | Companies |
| `identification` | `{ type, number, issuer?, ... }` | IDs, licenses, passports |
| `uuid` | `string` | Unique identifiers |
| `uri` | `string` | URLs, URIs |
| `enum` | union of values | Single-select from list |
| `multiselect` | `value[]` | Multi-select from list |
| `coordinate` | `{ lat, lon }` | GPS coordinates |
| `bbox` | `{ southWest, northEast }` | Geographic bounding boxes |
| `fieldset` | nested fields | Grouped/nested fields |

### Type-specific properties

#### text, email, uuid, uri

| Property | Type | Description |
|----------|------|-------------|
| `minLength` | number | Minimum length |
| `maxLength` | number | Maximum length |
| `pattern` | string | Regex (max 500 chars) — text/uuid/uri only |

```json
"fullName": { "type": "text", "label": "Full Legal Name", "required": true, "minLength": 2, "maxLength": 100 }
```

#### boolean

No type-specific properties.

```json
"agreeToTerms": { "type": "boolean", "label": "I agree", "required": true, "default": false }
```

#### number, money

| Property | Type | Description |
|----------|------|-------------|
| `min` | number | Minimum value |
| `max` | number | Maximum value |

```json
"annualSalary": { "type": "money", "label": "Annual Salary", "required": true, "min": 0 }
```

#### percentage

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `min` | number | 0 | Minimum |
| `max` | number | 100 | Maximum |
| `precision` | number | 2 | Decimal places |

#### rating

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `min` | number | 1 | Minimum |
| `max` | number | 5 | Maximum |
| `step` | number | 1 | Increment (e.g., 0.5 for half stars) |

#### date, datetime, time

`min` and `max` are ISO strings appropriate to the type.

```json
"dateOfBirth": { "type": "date", "label": "Date of Birth", "required": true, "max": "2008-01-01" }
```

#### identification

| Property | Type | Description |
|----------|------|-------------|
| `allowedTypes` | string[] | e.g., `["passport", "drivers_license", "state_id"]` |

#### enum (single-select)

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `enum` | YES | (string\|number)[] | Allowed values (min 1 item) |

```json
"employmentStatus": {
  "type": "enum",
  "label": "Employment Status",
  "enum": ["employed", "self-employed", "unemployed", "retired", "student"],
  "required": true
}
```

#### multiselect

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `enum` | YES | (string\|number)[] | Available options |
| `min` | No | number | Minimum selections |
| `max` | No | number | Maximum selections |

#### duration, phone, address, person, organization, coordinate, bbox

No type-specific properties — use the field as-is. Data shapes are listed in the table above.

## Fieldsets

A fieldset groups nested fields under a single key.

**Required:** `type: "fieldset"`, `fields`

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `type` | YES | `"fieldset"` | Discriminator |
| `fields` | YES | object | Nested field definitions (recursive) |
| `label` | No | string | Group label |
| `description` | No | string | Help text |
| `required` | No | CondExpr | Whether the fieldset is required |
| `visible` | No | CondExpr | Conditional visibility |

```json
"previousAddress": {
  "type": "fieldset",
  "label": "Previous Address",
  "fields": {
    "street": { "type": "text", "label": "Street", "required": true },
    "city": { "type": "text", "label": "City", "required": true },
    "yearsLived": { "type": "number", "label": "Years at Address", "min": 0 }
  }
}
```

**Use fieldsets when:** 3+ closely-related fields, repeated logical groupings (previous address, emergency contact), rendered output needs a section heading.
**Skip fieldsets when:** 1-2 fields, unrelated fields, small flat form.

## Design Heuristics

### Type selection table

ALWAYS use the most specific type.

| Data Being Collected | MUST Use Type | NOT This |
|---------------------|---------------|----------|
| Dollar amounts, prices, fees, salaries | `money` | `number` or `text` |
| Dates (birth date, start date, deadline) | `date` | `text` |
| Date + time (appointments) | `datetime` | `text` |
| Time only (business hours) | `time` | `text` |
| Time periods (lease term, warranty) | `duration` | `text` |
| Yes/no, true/false, single checkbox | `boolean` | `text` or `enum` |
| Single selection from options | `enum` | `text` |
| Multiple selections from options | `multiselect` | `text` |
| Counts, quantities, whole numbers | `number` | `text` |
| Percentages, rates | `percentage` | `number` |
| Ratings, scores | `rating` | `number` |
| Email addresses | `email` | `text` |
| Phone numbers | `phone` | `text` |
| Postal addresses | `address` | `text` |
| Person names/details | `person` | `text` |
| Organization/company info | `organization` | `text` |
| Government IDs (SSN, EIN, passport) | `identification` or `text`+`pattern` | `text` only |
| URLs, website links | `uri` | `text` |
| Unique identifiers, reference numbers | `uuid` | `text` |
| GPS coordinates | `coordinate` | `text` |
| Geographic boundaries | `bbox` | `text` |
| Group of related sub-fields | `fieldset` | Multiple top-level fields |
| Free-form text, names, descriptions | `text` | — |

Use `text` ONLY when no other type fits: free-form names (`"John Doe"`), descriptions, notes, reference numbers with unusual formats.

### Naming patterns by domain

| Domain | Example Field IDs |
|--------|------------------|
| Personal info | `firstName`, `lastName`, `dateOfBirth`, `email`, `phone` |
| Address | `streetAddress`, `city`, `state`, `zipCode`, `country` |
| Financial | `annualIncome`, `monthlyExpenses`, `creditScore`, `loanAmount` |
| Employment | `employerName`, `jobTitle`, `startDate`, `annualSalary` |
| Property | `propertyAddress`, `monthlyRent`, `securityDeposit`, `leaseStartDate` |
| Medical | `primaryPhysician`, `allergies`, `medications`, `insuranceProvider` |

Use specific names (`monthlyRent`, not `amount`). Use suffixes to disambiguate (`leaseStartDate` not `date`).

### Pattern constraints — common identifiers

| Field | Pattern |
|-------|---------|
| SSN | `^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$` |
| EIN | `^[0-9]{2}-?[0-9]{7}$` |
| US ZIP | `^[0-9]{5}(-[0-9]{4})?$` |

### Field ordering

Fields render in definition order. Suggested order:

1. Identification (name, ID numbers)
2. Contact (email, phone, address)
3. Domain-specific (financial, property, medical)
4. Conditional/optional fields
5. Agreement/consent fields

### Progressive disclosure

Use `visible` expressions to keep the form simple:

```json
"hasPets": { "type": "boolean", "label": "Do you have pets?", "default": false },
"petCount": {
  "type": "number",
  "label": "Number of Pets",
  "visible": "fields.hasPets == true",
  "required": "fields.hasPets == true",
  "min": 1,
  "max": 10
}
```

## SDK Builders

For TypeScript SDK forms, fields can be defined with object literals (preferred) OR with `para.field.*()` builders. See [sdk.md](./sdk.md) for full SDK patterns.

```typescript
// Object pattern (preferred)
fields: {
  name: { type: "text", label: "Full Name", required: true },
  amount: { type: "money", label: "Amount", required: true },
}

// Builder pattern
fields: {
  name: para.field.text().label("Full Name").required().maxLength(100),
  amount: para.field.money().label("Amount").required().min(0),
  status: para.field.enum().options(["a", "b"]).label("Status").required(),
}
```

NEVER mix object and builder patterns within a single artifact.

## Adding a Field — Step by Step (JSON)

1. Choose a camelCase identifier matching `^[a-z][a-zA-Z0-9_]*$`
2. Add the field to the `fields` object
3. Set `type` (REQUIRED for all non-fieldset fields)
4. Add `label`, `required`, `visible`, type-specific constraints
5. Run `npx paradoc validate <file>` (see [schemas.md](./schemas.md))

## See Also

- [logic.md](./logic.md) — CondExpr syntax for `required` and `visible`
- [serialization.md](./serialization.md) — locale-aware formatting at render time
- [parties.md](./parties.md) — party roles
- [annexes.md](./annexes.md) — file attachments
- [sdk.md](./sdk.md) — type inference from form definitions
