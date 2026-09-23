---
name: logic
description: CondExpr syntax, defs, and rules — expression context, operators, available functions, list aggregates, design heuristics
metadata:
  tags: logic, expressions, condexpr, defs, rules, validation, severity, aggregates, lists
---

# Logic

**Contents:** [CondExpr](#conditional-expressions-condexpr) · [Operators](#expression-operators) · [Context summary](#expression-context-summary) · [Functions](#available-functions) · [List aggregates](#list-aggregates) · [Defs](#defs-section) · [Rules](#rules-section) · [Design heuristics](#design-heuristics)

Paradoc artifacts support three kinds of logic:

| Kind | Where | Used for |
|------|-------|----------|
| **CondExpr** | `required`, `visible` on fields/parties/annexes | Conditional behavior |
| **Defs** | Top-level `defs` (forms + bundles) | Reusable computed values |
| **Rules** | Top-level `rules` (forms only) | Cross-field validation |

The same language runs inside every layer template (Markdown, HTML, text, DOCX): see [layers.md](./layers.md#paradoc-template-syntax).

## Conditional Expressions (CondExpr)

A CondExpr is either a boolean literal or an expression string:

```json
"required": true
"required": "fields.hasPets == true"
"visible": "fields.employmentStatus == 'employed'"
```

## Expression Operators

| Operator | Description |
|----------|-------------|
| `==`, `!=` | Equality / inequality |
| `>`, `>=`, `<`, `<=` | Comparison |
| `and` | Logical AND (`&&` is rejected) |
| `or` | Logical OR (`\|\|` is rejected) |
| `not`, `!` | Logical NOT |
| `in`, `not in` | Membership in a list |
| `+`, `-`, `*`, `/`, `%` | Arithmetic |

## Expression Context Summary

CRITICAL: the context for referencing fields/defs differs by location.

| Context | Field access | Defs access |
|---------|-------------|-------------|
| Field `required` / `visible` | `fields.<id>` | Direct def key name |
| List-item `required` / `visible` (the item and fields inside it) | `fields.<id>`, plus `item.<id>` for the current row and `parent.<id>` for the enclosing row of a nested list | Direct def key name |
| Defs `value` | `fields.<id>` | Direct key name (previously evaluated defs) |
| Rules `expr` | Direct field name (no prefix) | Direct key name |
| Layer templates (`{{ }}`) | `fields.<id>`, plus `item`/`parent` inside `{{#each}}` | Direct def key name |

Every context also reads `parties.<role>` (a list for a role with `max > 1`: `count(parties.tenant) > 1`). A checklist template reads `items.<id>`; a key that is not an identifier uses brackets, `items["signed-contract"]`.

Field-level expressions ALWAYS use `fields.<id>`. Rules expressions use bare names.

### Row references (`item`, `parent`)

Inside a list item, `item` is the current row. In a list nested in a list item, `parent` is the enclosing row. Use them for per-row conditions:

```json
"lines": {
  "type": "list",
  "item": {
    "type": "fieldset",
    "fields": {
      "kind": { "type": "enum", "enum": [{ "value": "travel" }, { "value": "other" }] },
      "explanation": { "type": "text", "visible": "item.kind == 'other'", "required": "item.kind == 'other'" },
      "parts": {
        "type": "list",
        "item": { "type": "fieldset", "fields": {
          "cost": { "type": "number" },
          "note": { "type": "text", "required": "parent.kind == 'other' and item.cost > 100" }
        } }
      }
    }
  }
}
```

- A scalar item (a list of `number`) is `item` itself; composite values keep their parts (`item.amount`).
- Only row conditions see rows. Defs, rules, annexes, parties, and the list field's own `visible`/`required` do not; `item` there fails validation, and so does `parent` outside a nested list.
- `item` and `parent` are reserved: a def with either name fails validation.

## Available Functions

Party functions take a `roleId` (party role key as string). Witness functions take no parameters.

| Function | Returns | Description |
|----------|---------|-------------|
| `partyCount(roleId)` | number | Count of parties in role |
| `partyType(roleId)` | string | `"person"` or `"organization"` |
| `allSigned(roleId)` | boolean | All parties signed |
| `signedCount(roleId)` | number | Count of signed parties |
| `anySigned(roleId)` | boolean | Any party signed |
| `witnessCount()` | number | Total witnesses |
| `allWitnessesSigned()` | boolean | All witnesses signed |
| `anyWitnessSigned()` | boolean | Any witness signed |

```json
"visible": "partyCount('buyer') > 1"
"required": "!allSigned('seller')"
```

## List Aggregates

Seven functions compute one value from the rows of a `list` field. Each takes a path into the list and an optional boolean filter over the same rows.

| Function | Values | No rows |
|----------|--------|---------|
| `sum(path, filter?)` | number, percentage, money | `0` |
| `count(path, filter?)` | any row | `0` |
| `avg(path, filter?)` | number, percentage, money | `null` |
| `min(path, filter?)` / `max(path, filter?)` | number, percentage, money, date, datetime, time | `null` |
| `any(path, filter?)` | boolean | `false` |
| `all(path, filter?)` | boolean | `true` |

```json
"subtotal": { "type": "money", "value": { "amount": "sum(fields.lineItems.amount).amount", "currency": "fields.currency" } },
"taxableTotal": { "type": "number", "value": "sum(fields.lineItems.amount.amount, fields.lineItems.taxable)" },
"hasOther": { "type": "boolean", "value": "count(fields.lineItems, fields.lineItems.kind == 'other') > 0" }
```

- `fields.lineItems.amount` reads every row's `amount`; `fields.lineItems` alone is the rows (for `count`).
- In the filter, `fields.lineItems.taxable` is the current row's value. A filter on a different list is an authoring error.
- Nested lists flatten: `sum(fields.orders.parts.cost)` totals every part of every order; a filter may test either level.
- Inside a list item, `sum(item.parts.cost)` aggregates the current row's own nested list.
- Hidden rows (list, a field above it, or `item` not visible) never count. `null` values are skipped by `sum`/`avg`/`min`/`max`; `count` still counts the row.
- Money keeps its currency. Mixed currencies fail evaluation, naming the currencies. An empty money sum is the number `0`.
- A list path outside an aggregate (`fields.lineItems.amount > 0`) is an authoring error. There are no lambdas, `map`, `filter`, or `reduce`.
- `min`/`max` with non-list arguments still compare their arguments, skipping `null` ones.
- NEVER add a hand-entered total field that the artifact can compute with `sum`.

## Defs Section

The `defs` section defines typed computed values. Available on **forms** and **bundles**. Each def has a key (pattern `^[a-z][a-zA-Z0-9_]*$`) and a definition object.

**Required per def:** `type`, `value`
**Optional:** `label`, `description`

### Simple types

For simple types, `value` is an expression string.

| Type | Evaluates to |
|------|-------------|
| `boolean` | `true` / `false` |
| `string` | String value |
| `number` | Numeric value |
| `integer` | Integer value |
| `percentage` | Percentage (0-100) |
| `rating` | Rating value |
| `date` | ISO date (`YYYY-MM-DD`) |
| `time` | Time (`HH:MM:SS`) |
| `datetime` | ISO datetime |
| `duration` | ISO duration |

```json
"defs": {
  "isHighValue": {
    "type": "boolean",
    "value": "fields.loanAmount > 500000",
    "label": "High Value Loan"
  },
  "totalIncome": {
    "type": "number",
    "value": "fields.salary + fields.bonusIncome + fields.otherIncome"
  },
  "debtRatio": {
    "type": "percentage",
    "value": "(fields.monthlyDebt / fields.monthlyIncome) * 100"
  }
}
```

### Compound types

For compound types, `value` is an object with expression strings per component.

**money** — `amount`, `currency` required:
```json
"totalCost": {
  "type": "money",
  "value": { "amount": "fields.price + fields.tax", "currency": "'USD'" }
}
```

**address** — `line1`, `locality`, `region`, `postalCode`, `country` required; `line2` optional:
```json
"computedAddress": {
  "type": "address",
  "value": {
    "line1": "fields.street",
    "locality": "fields.city",
    "region": "fields.state",
    "postalCode": "fields.zip",
    "country": "'US'"
  }
}
```

**phone** — `number` required; `type`, `extension` optional.
**coordinate** — `lat`, `lon` required.
**bbox** — `north`, `south`, `east`, `west` required.
**person** — `name` required; `title`, `firstName`, `middleName`, `lastName`, `suffix` optional.
**organization** — `name` required; `legalName`, `domicile`, `entityType`, `entityId`, `taxId` optional.
**identification** — `type`, `number` required; `issuer`, `issueDate`, `expiryDate` optional.

## Rules Section

The `rules` section defines form-level validation. Available on **forms** only. Each rule has a key (pattern `^[a-z][a-zA-Z0-9_]*$`).

**Required per rule:** `expr`, `message`

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `expr` | YES | string | Boolean expression — MUST evaluate `true` for the form to be valid |
| `message` | YES | string | Error message (max 500 chars) |
| `severity` | No | string | `"error"` (default, blocks) or `"warning"` (advisory) |

### Expression context in rules

In rules, field values are accessed **directly by name** (NO `fields.` prefix). Defs values are also accessible directly.

```json
"rules": {
  "endAfterStart": {
    "expr": "endDate > startDate",
    "message": "End date must be after start date"
  },
  "rentWithinRange": {
    "expr": "monthlyRent >= 500 && monthlyRent <= 10000",
    "message": "Monthly rent must be between $500 and $10,000",
    "severity": "error"
  },
  "depositWarning": {
    "expr": "securityDeposit <= monthlyRent * 2",
    "message": "Security deposit exceeds 2x monthly rent",
    "severity": "warning"
  }
}
```

### Using defs in rules

Defs are referenced by their key name:

```json
"defs": {
  "totalDebt": {
    "type": "number",
    "value": "fields.creditCardDebt + fields.studentLoans + fields.carPayment"
  }
},
"rules": {
  "debtToIncome": {
    "expr": "totalDebt / monthlyIncome < 0.43",
    "message": "Debt-to-income ratio must be below 43%"
  }
}
```

## Design Heuristics

### When to add each kind of logic

| Signal | Add |
|--------|-----|
| "Show field X only when field Y is true/selected" | `visible` expression on X |
| "Require field X only when field Y has a value" | `required` expression on X |
| "The same condition is used in 3+ places" | A `defs` entry to avoid repetition |
| "Total must equal sum of parts" | A `defs` entry computing the total with `sum(...)` |
| "Every row must have a positive quantity" | A `rules` entry: `count(fields.items, fields.items.qty <= 0) == 0` |
| "End date must be after start date" | A `rules` entry |
| "Deposit cannot exceed 2x rent" | A `rules` entry |
| "Show warning when ratio exceeds threshold" | A `rules` entry with `severity: "warning"` |

### Progressive disclosure pattern

Most common conditional pattern — show fields based on a trigger:

```json
"hasVehicle": { "type": "boolean", "label": "Do you own a vehicle?", "default": false },
"vehicleMake": {
  "type": "text",
  "label": "Vehicle Make",
  "visible": "fields.hasVehicle == true",
  "required": "fields.hasVehicle == true"
},
"vehicleModel": {
  "type": "text",
  "label": "Vehicle Model",
  "visible": "fields.hasVehicle == true",
  "required": "fields.hasVehicle == true"
}
```

### Extracting repeated conditions into defs

Before (repeated):
```json
"petCount": { "visible": "fields.hasPets == true && fields.propertyAllowsPets == true" },
"petBreed": { "visible": "fields.hasPets == true && fields.propertyAllowsPets == true" },
"petDeposit": { "visible": "fields.hasPets == true && fields.propertyAllowsPets == true" }
```

After (extracted):
```json
"defs": {
  "petsApplicable": {
    "type": "boolean",
    "value": "fields.hasPets == true && fields.propertyAllowsPets == true"
  }
}
```

Reference in fields: `"visible": "petsApplicable == true"` (NOT `fields.petsApplicable`).

### Naming conventions

- Defs / rules pattern: `^[a-z][a-zA-Z0-9_]*$`, camelCase
- Boolean defs: prefix with `is` or `has` (`isHighRisk`, `hasGuarantor`)
- Computed values: descriptive name (`totalIncome`, `debtRatio`, `monthlyPayment`)
- Rules: describe what is validated (`endAfterStart`, `depositLimit`)
- NEVER use generic names (`rule1`, `check`, `validation`)

### Ordering

1. Define defs BEFORE rules that reference them
2. Order defs from simple to complex (base values first, derived second)
3. Order rules from most critical to least

### Common rule patterns

```json
"endAfterStart": { "expr": "endDate > startDate", "message": "End date must be after start date" }
"depositLimit": { "expr": "securityDeposit <= monthlyRent * 2", "message": "Deposit cannot exceed 2x rent" }
"employerRequired": { "expr": "employmentStatus != 'employed' || employerName != ''", "message": "Employer name required when employed" }
"debtToIncome": { "expr": "totalMonthlyDebt / monthlyIncome < 0.43", "message": "DTI must be below 43%" }
"highDeposit": { "expr": "securityDeposit <= monthlyRent * 1.5", "message": "Deposit exceeds 1.5x rent", "severity": "warning" }
```

## SDK Patterns

### Defs (TypeScript)

The `.def(name, expr)` builder shorthand defaults to `type: "boolean"` and accepts a plain string. The object pattern requires the full `{ type, value }` form.

```typescript
// Builder shorthand
const form = p.form()
  .def("isLongTerm", "fields.leaseTermMonths >= 12")
  .def("isCommercial", "fields.propertyType == 'commercial'")
  .build();

// Object pattern (full form)
const form = p.form({
  defs: {
    isLongTerm: { type: "boolean", value: "fields.leaseTermMonths >= 12" },
    totalCost: { type: "money", value: { amount: "fields.price + fields.tax", currency: "'USD'" } },
  },
});
```

### Rules (TypeScript)

The form builder does NOT have a `.rules()` method. Rules MUST use object pattern:

```typescript
const form = p.form({
  rules: {
    endAfterStart: { expr: "leaseEnd > leaseStart", message: "End must be after start", severity: "error" },
    depositLimit: { expr: "securityDeposit.amount <= monthlyRent.amount * 2", message: "Deposit too high", severity: "warning" },
  },
});
```

### Runtime evaluation (SDK)

```typescript
const draft = form.fill(data);

draft.isFieldVisible("petName");   // boolean
draft.isFieldRequired("petName");  // boolean

const results = draft.validateRules();
// => FormRulesValidationResult { valid, errors, warnings, rules }

const state = draft.runtimeState;
```

### Design-time validation

```typescript
import { validateLogic } from "@paradoc/core";

const errors = validateLogic(form);
// Catches: invalid field references, type mismatches, circular dependencies
```

## See Also

- [fields.md](./fields.md) — `required` / `visible` CondExpr on fields
- [parties.md](./parties.md) — `required` CondExpr; party functions
- [artifacts.md](./artifacts.md) — which artifacts support defs and rules
- [schemas.md](./schemas.md) — `npx paradoc validate`
