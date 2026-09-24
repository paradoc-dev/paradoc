---
name: logic
description: The Paradoc expression language. Where expressions go and what each site reads, grammar and precedence, every builtin function, list aggregates, row references, typing rules, missing and failed values, the as-of clock, limits, defs, rules, and the @paradoc/expr API.
metadata:
  tags: logic, expressions, condexpr, defs, rules, functions, aggregates, lists, dates, clock, expr
---

# Logic

**Contents:** [Sites](#where-expressions-go) · [Grammar](#grammar) · [Types](#types) · [Functions](#functions) · [List aggregates](#list-aggregates) · [Row references](#row-references-item-parent) · [Missing and failed values](#missing-and-failed-values) · [Dates and the clock](#dates-and-the-clock) · [Defs](#defs) · [Rules](#rules) · [Limits](#limits) · [Patterns](#patterns) · [SDK](#sdk) · [@paradoc/expr](#the-paradocexpr-api)

One expression language drives every artifact: conditions, defs, rules, bundle `include`, party payment amounts, and the `{{ }}` markers in templates. `paradoc validate` (or `validate()` in code) type-checks every expression in an artifact and exits 0 only when every reference resolves and every type fits.

## Where expressions go

| Site | Property | Result must be | Reads |
|------|----------|----------------|-------|
| Field | `required`, `visible` | boolean | `fields.<id>`, defs by key, `parties.<role>`, party functions |
| Field inside a list item | `required`, `visible` | boolean | the same, plus `item` and `parent` ([Row references](#row-references-item-parent)) |
| Annex | `required`, `visible` | boolean | same as a field |
| Party role | `required` | boolean | same as a field |
| Party role | `payment.amount.value.amount` / `.currency` | number / string | same as a field ([parties.md § Payment](./parties.md#payment)) |
| Def (form) | `value` | the def's declared `type` | `fields.<id>`, other defs by key, `parties.<role>` |
| Rule | `expr` | boolean | everything a def reads, plus field ids as bare names |
| Bundle item | `include` | boolean | `forms.<key>.fields.<id>`, `forms.<key>.<defKey>`, `bundles.<key>.forms.<key>.fields.<id>`, bundle defs ([artifacts.md § Include conditions](./artifacts.md#include-conditions)) |
| Def (bundle) | `value` | the def's declared `type` | same as bundle `include` |
| Template | `{{ … }}` | a value to print, or boolean in a condition | what field conditions read, `items.<id>` in a checklist, `item`/`parent` in a loop ([templates.md](./templates.md)) |

A condition (CondExpr) is `true`, `false`, or an expression string.

Reference rules:

- Read a field as `fields.<id>`, and a nested value by path: `fields.home.country`, `fields.rent.amount`. Rules also accept a bare field id; write `fields.<id>` in every site so one form reads the same everywhere.
- Read a def by its bare key: `isAdult`. `defs.isAdult` is an unknown reference.
- `parties.<role>` is one party, or a list when the role's `max` is above 1: `count(parties.tenant) > 1`, `parties.tenant[0].name`.

## Grammar

### Literals

| Literal | Examples |
|---------|----------|
| Number | `42`, `0.075` (exact decimal) |
| String | `'employed'`, `"it's"`, `'it\'s'` |
| Boolean | `true`, `false` |
| Null | `null` |
| Array | `['CA', 'NY']`, `[]` |

### Operators

Tightest binding first. All binary operators are left-associative.

| Precedence | Operators | Notes |
|------------|-----------|-------|
| 1 | `x.y`, `x[0]`, `x['key']`, `f(…)` | Member access is null-safe. Brackets index arrays or read a key that is not an identifier (`items['signed-contract']`). |
| 2 | `not x`, `!x`, `-x` | `!` is an alias for `not`. |
| 3 | `*`, `/`, `%` | Numbers only. |
| 4 | `+`, `-` | `+` adds numbers, or concatenates when either side is a string (`'Hi ' + fields.name`). |
| 5 | `in`, `not in` | Membership in an array, or substring in a string. |
| 6 | `<`, `<=`, `>`, `>=` | Numbers, strings, or two values of the same temporal type. |
| 7 | `==`, `!=` | Any values. |
| 8 | `and` | Short-circuits. |
| 9 | `or` | Short-circuits. |
| 10 | `cond ? a : b` | Loosest. |

Unary operators bind tighter than comparison. `not fields.a == 1` means `(not fields.a) == 1`. Write `fields.a != 1` or `not (fields.a == 1)`.

### Rejected forms

| Written | Error | Write instead |
|---------|-------|---------------|
| `a && b` | `Use 'and'; '&&' is not supported.` | `a and b` |
| `a \|\| b` | `Use 'or' for logic and '+' to concatenate strings; '\|\|' is not supported.` | `a or b` |
| `a = 1` | `Use '==' for equality; '=' (assignment) is not allowed.` | `a == 1` |
| `indexOf(…)`, `age()`, any unlisted name | `Unknown function: <name>` | a function from [Functions](#functions) |

Work over list rows with the [list aggregates](#list-aggregates) and their filters; there are no lambdas, `map`, `filter`, or `reduce`. The words `and or not in true false null` are reserved and never read as names.

## Types

Each field type has one expression type. Operators and functions check against it.

| Field type | Expression type | Read it as |
|------------|-----------------|------------|
| `text`, `email`, `uuid`, `uri` | string | `fields.name` |
| `number`, `percentage`, `rating` | number | `fields.qty` |
| `boolean` | boolean | `fields.hasPets` |
| `date`, `datetime`, `time` | date, datetime, time | `fields.startDate` |
| `duration` | duration (ISO 8601, `P1Y2M`) | `addDuration(fields.start, fields.term)` |
| `money` | money | `fields.rent.amount` (number), `fields.rent.currency` (string) |
| `enum` | string (number when every option value is a number) | `fields.status == 'employed'` |
| `multiselect` | array of option values | `'email' in fields.channels` |
| `fieldset` | object | `fields.applicant.email` |
| `list` | array of rows | `count(fields.items)`, `fields.items[0].qty` |
| `address`, `phone`, `coordinate`, `bbox`, `person` | object | `fields.home.country`, `fields.area.southWest.lat` |

Member names follow the value shapes in [fields.md](./fields.md).

### Conditions are boolean

A gate (`required`, `visible`, `include`, rule `expr`, aggregate filter) must type-check as boolean. `"visible": "fields.nickname"` on a text field fails with `A gate must be boolean, got string`. Write the test you mean:

```text
isNotEmpty(fields.nickname)
fields.nickname != null
fields.qty > 0
```

`and`, `or`, `not`, and the ternary test read their operands by truthiness: `null`, `false`, `0`, `''`, and `[]` are false; everything else is true. The gate's final result must still be boolean.

### Money

Arithmetic and ordering work on numbers, so read `.amount`:

| Written | Result |
|---------|--------|
| `fields.deposit <= fields.rent * 2` | `Operator '*' requires numbers, got money and number` |
| `fields.deposit.amount <= fields.rent.amount * 2` | valid |
| `fields.price + fields.tax` | `Cannot add money and money` |
| `fields.price.amount + fields.tax.amount` | valid |

`sum`, `avg`, `min`, and `max` over a list accept money directly and keep its currency. `==` compares whole values, so `fields.a == fields.b` on money compares amount and currency.

### Dates, datetimes, times

- Compare two values of the same temporal type: `fields.endDate > fields.startDate`, `fields.startDate <= today()`, `fields.signedAt < now()`.
- A string literal is not a date. `fields.startDate > '2020-01-01'` fails with `Cannot compare date and string`. Pass the literal to a date function, which validates it: `dateDiff('2020-01-01', fields.startDate) > 0`.
- Date values are `YYYY-MM-DD`. Datetime values need `Z` or an offset. Times are `HH:MM` or `HH:MM:SS`.

### Numbers

Numbers are exact decimals: `0.1 + 0.2 == 0.3` is true. Division keeps up to 20 fractional places. Division by zero fails the expression ([Missing and failed values](#missing-and-failed-values)).

## Functions

The complete builtin set (`DEFAULT_SIGNATURES` in `@paradoc/expr`). Any other name is `Unknown function`.

### String and value functions

| Function | Returns | Behavior |
|----------|---------|----------|
| `contains(haystack, needle)` | boolean | Substring in a string, or element in an array. `false` when `haystack` is `null`. |
| `startsWith(value, prefix)` | boolean | |
| `endsWith(value, suffix)` | boolean | |
| `trim(value)` | string | |
| `lower(value)` | string | |
| `upper(value)` | string | |
| `matches(value, pattern)` | boolean | Regex test over a bounded subset: literals, classes `[A-Z]`, anchors `^ $`, `.`, escapes `\d`. Repetition `+ * ? {n}`, alternation `\|`, groups starting `(?`, and backreferences fail with `limit-exceeded`. `validate` does not catch them; the fill does. Pattern at most 512 chars, input at most 10,000. |
| `isEmpty(value)` | boolean | `true` for `null`, `''`, or `[]`. |
| `isNotEmpty(value)` | boolean | The negation of `isEmpty`. |
| `length(value)` | number | Characters of a string, or elements of an array (list rows, multiselect choices). `0` for `null`. |
| `coalesce(a, b, …)` | common type of the arguments | The first argument that is not `null`, left to right. |

`startsWith`, `endsWith`, `trim`, `lower`, `upper`, and `matches` need a string. With an unanswered field they make the expression missing, not failed.

### Number functions

| Function | Returns | Behavior |
|----------|---------|----------|
| `round(value, digits?)` | number | Half away from zero. `digits` defaults to `0` and must be a whole number from `0` to `1000`. `round(2.345, 2)` is `2.35`. |
| `floor(value)` | number | |
| `ceil(value)` | number | |
| `abs(value)` | number | |
| `min(a, b, …)` | number | Smallest argument, skipping `null`. `null` when every argument is `null`. |
| `max(a, b, …)` | number | Largest argument, skipping `null`. |

Given a path into a list, `min` and `max` aggregate instead ([List aggregates](#list-aggregates)).

### Date functions

| Function | Returns | Behavior |
|----------|---------|----------|
| `today()` | date | The as-of date ([Dates and the clock](#dates-and-the-clock)). |
| `now()` | datetime | The as-of instant. |
| `yearsBetween(from, to)` | number | Whole calendar years from `from` to `to`. Age: `yearsBetween(fields.birthDate, today())`. |
| `dateDiff(from, to, unit?)` | number | `to - from` in `'days'` (default), `'months'`, or `'years'`, truncated. Any other unit fails. |
| `addDays(date, days)` | date | `days` may be negative. |
| `addDuration(date, duration)` | date | Date components only (`P1Y2M3W4D`). Month and year steps clamp to the last valid day: `addDuration('2026-01-31', 'P1M')` is `2026-02-28`. |

### Party and witness functions

| Function | Returns | Behavior |
|----------|---------|----------|
| `partyCount(role)` | number | Parties filled in the role. |
| `partyType(role)` | string | `'person'` or `'organization'`. `''` when the role has no party. |
| `signedCount(role)` | number | Parties in the role whose signature is captured. |
| `allSigned(role)` | boolean | `false` when the role has no party. |
| `anySigned(role)` | boolean | |
| `witnessCount()` | number | |
| `allWitnessesSigned()` | boolean | `false` when there are no witnesses. |
| `anyWitnessSigned()` | boolean | |

`role` is the role key as a string literal: `partyCount('tenant') > 1`.

The signing functions read the instance's signing records: a party has signed once its `signature` capture exists (initials alone do not count), and a witness once it has an attestation. Before signing they are `0` or `false`, so a rule over them blocks `prepareForSigning()` unless its `severity` is `"warning"`.

The aggregates `sum`, `count`, `avg`, `min`, `max`, `any` and `all` complete the set ([List aggregates](#list-aggregates)).

## List aggregates

Seven functions compute one value from the rows of a `list` field. Each takes a path into the list and an optional boolean filter over the same rows.

| Function | Values | No rows |
|----------|--------|---------|
| `sum(path, filter?)` | number, percentage, money | `0` |
| `count(path, filter?)` | any row | `0` |
| `avg(path, filter?)` | number, percentage, money | `null` |
| `min(path, filter?)` / `max(path, filter?)` | number, percentage, money, date, datetime, time | `null` |
| `any(path, filter?)` | boolean | `false` |
| `all(path, filter?)` | boolean | `true` |

```json schema=form
{
  "fields": {
    "currency": { "type": "text", "default": "USD" },
    "lineItems": {
      "type": "list",
      "item": {
        "type": "fieldset",
        "fields": {
          "kind": { "type": "enum", "enum": [{ "value": "goods" }, { "value": "other" }] },
          "qty": { "type": "number" },
          "amount": { "type": "money" },
          "taxable": { "type": "boolean" }
        }
      }
    }
  },
  "defs": {
    "subtotal": { "type": "money", "value": { "amount": "sum(fields.lineItems.amount.amount)", "currency": "fields.currency" } },
    "taxableTotal": { "type": "number", "value": "sum(fields.lineItems.amount.amount, fields.lineItems.taxable)" },
    "hasOther": { "type": "boolean", "value": "count(fields.lineItems, fields.lineItems.kind == 'other') > 0" }
  },
  "rules": {
    "positiveQty": { "expr": "count(fields.lineItems, fields.lineItems.qty <= 0) == 0", "message": "Every line needs a positive quantity" }
  }
}
```

- `fields.lineItems.amount` reads every row's `amount`. `fields.lineItems` alone is the rows (for `count`).
- In the filter, `fields.lineItems.taxable` is the current row's value. A filter must test the same list.
- For a money total, sum the amounts: `sum(fields.lineItems.amount.amount)` is `0` for an empty list. `sum(fields.lineItems.amount).amount` is `null` for an empty list, because an empty sum is the number `0`, which has no `.amount`.
- Nested lists flatten: `sum(fields.orders.parts.cost)` totals every part of every order. A filter may test either level.
- Inside a list item, `sum(item.parts.cost)` aggregates the current row's own nested list.
- Hidden rows (the list, a field above it, or the row itself not visible) never count. A row whose `visible` condition reads a missing input is hidden, as it is in the form state. `sum`, `avg`, `min`, and `max` skip `null` values. `count` still counts the row.
- Money keeps its currency. Mixed currencies fail the expression, naming the currencies.
- A list path outside an aggregate (`fields.lineItems.qty > 0`) fails validation. Index one row with brackets: `fields.lineItems[0].qty`.
- Compute a total of rows as a `sum` def, so it always agrees with its rows.

## Row references (`item`, `parent`)

Inside a list item, `item` is the current row. In a list nested in a list item, `parent` is the enclosing row. Use them for per-row conditions:

```json schema=form
{
  "fields": {
    "lines": {
      "type": "list",
      "item": {
        "type": "fieldset",
        "fields": {
          "kind": { "type": "enum", "enum": [{ "value": "travel" }, { "value": "other" }] },
          "explanation": { "type": "text", "visible": "item.kind == 'other'", "required": "item.kind == 'other'" },
          "parts": {
            "type": "list",
            "item": {
              "type": "fieldset",
              "fields": {
                "cost": { "type": "number" },
                "note": { "type": "text", "required": "parent.kind == 'other' and item.cost > 100" }
              }
            }
          }
        }
      }
    }
  }
}
```

- A scalar item (a list of `number`) is `item` itself: `"required": "item > 0"`. Composite items keep their parts: `item.amount.amount`.
- Only conditions inside a list item see rows. Defs, rules, annexes, parties, and the list field's own `visible`/`required` do not. `item` there fails validation, and so does `parent` outside a nested list.
- `item` and `parent` are reserved: a def with either name fails validation. So are `fields` and `parties` ([Defs](#defs)).

## Missing and failed values

A reference to a field with no answer reads as `null`. Member access through `null` is `null`. From there:

| Expression over a missing value | Result |
|---------------------------------|--------|
| `fields.x == null` | `true` |
| `fields.x != 'a'` | `true`, so a gate like `fields.status != 'employed'` holds before the field is answered |
| `fields.x > 1`, `fields.x < 1` | `false` |
| `isEmpty(fields.x)`, `coalesce(fields.x, 0)`, `length(fields.x)` | handle `null` themselves |
| `fields.x * 2`, `upper(fields.x)`, a def over it | **missing** |

A **missing** result is not an error. It means the expression cannot be computed yet:

- A def is `null` while an input it reads is unanswered or another def is missing. Defs need no `x == null ? null : …` guards.
- A condition over a missing value is false: the field waits on its inputs.
- A rule over a missing value is not met and fails with its own `message`.

A result **fails** when the operation that errors did not read a missing value: a type mismatch, division by zero, a mixed-currency sum, a `matches` pattern outside the subset. A missing value elsewhere does not hide the failure: `(fields.total - coalesce(fields.discount, 0)) / fields.count` with no discount and a count of `0` fails with division by zero. Then:

- A failed def reads as missing, and `getFillState().issues` has an entry with path `["defs", "<key>"]`. The rest of the form still evaluates, and completion is blocked.
- A failed condition uses the property's default and adds an issue.
- A failed rule fails with `Rule expression error: <error>`.

A value with no expression form, such as `NaN` or `Infinity` passed through the SDK, is not missing: every expression that reads its root fails with a `type-error` naming its path.

## Dates and the clock

`today()` and `now()` read the instance's retained clock, never the wall clock during evaluation. `fill()` captures the current instant once, and the instance keeps it through `update()` and `toJSON()`. Pass `asOf` to fix it for reproducible results and tests:

```typescript
import { p } from "@paradoc/sdk";

const form = p.form({
  $schema: "https://schema.paradoc.dev/2026-09-24.json",
  name: "age-check",
  kind: "form",
  fields: { birthDate: { type: "date" } },
  defs: { age: { type: "number", value: "yearsBetween(fields.birthDate, today())" } },
});

let draft = form.fill({ fields: { birthDate: "2000-06-15" } }, { context: { asOf: "2026-01-01T09:00:00Z" } });
draft.getLogicValue("age"); // 25

draft = draft.update({ fields: { birthDate: "1990-06-15" } });
draft.getLogicValue("age"); // 35, same clock
```

- `asOf` is an ISO instant with `Z` or an offset. `"2026-01-01"` alone throws `Invalid context.asOf`.
- `today()` is the UTC calendar date of that instant: `2026-01-01T02:00:00+05:00` gives `2025-12-31`.

## Defs

`defs` holds typed computed values, on forms and bundles. Each def has a key (`^[a-z][a-zA-Z0-9_]*$`), a `type`, a `value`, and optional `label` and `description`. The keys `fields`, `parties`, `item`, and `parent` are reserved and fail validation. Defs may reference each other in any key order. A cycle is reported as a warning (`Circular dependency detected`).

For a scalar type, `value` is one expression string, checked against the declared type (`Expected expression type number, got boolean`):

| `type` | `value` evaluates to |
|--------|----------------------|
| `boolean` | boolean |
| `string` | string |
| `number`, `integer`, `percentage`, `rating` | number |
| `date`, `datetime`, `time`, `duration` | that temporal type |

For a compound type, `value` is an object with one expression per component:

| `type` | Components (required first) |
|--------|-----------------------------|
| `money` | `amount`, `currency` |
| `address` | `line1`, `locality`, `region`, `postalCode`, `country`; `line2` |
| `phone` | `number`; `type`, `extension` |
| `coordinate` | `lat`, `lon` |
| `bbox` | `southWest`, `northEast`, each with `lat` and `lon` |
| `person` | `name`; `title`, `firstName`, `middleName`, `lastName`, `suffix` |
| `organization` | `name`; `legalName`, `domicile`, `entityType`, `entityId`, `taxId` |
| `identification` | `type`, `number`; `issuer`, `issueDate`, `expiryDate` |

A compound def exposes its components: `total.amount`, `mailing.country`.

```json schema=form
{
  "fields": {
    "salary": { "type": "money" },
    "bonus": { "type": "money" },
    "monthlyDebt": { "type": "number" },
    "loanAmount": { "type": "number" },
    "applicantName": { "type": "text" }
  },
  "defs": {
    "totalIncome": {
      "type": "money",
      "value": { "amount": "fields.salary.amount + coalesce(fields.bonus.amount, 0)", "currency": "fields.salary.currency" }
    },
    "debtRatio": { "type": "percentage", "value": "round(fields.monthlyDebt / (totalIncome.amount / 12) * 100, 1)" },
    "isHighValue": { "type": "boolean", "value": "fields.loanAmount > 500000", "label": "High value loan" },
    "greeting": { "type": "string", "value": "'Dear ' + fields.applicantName" }
  }
}
```

## Rules

`rules` holds form-level checks, on forms only. Each rule key matches `^[a-z][a-zA-Z0-9_]*$`.

| Property | Required | Description |
|----------|----------|-------------|
| `expr` | yes | Boolean expression. The rule passes when it is `true`. |
| `message` | yes | Shown when the rule fails. 1-500 chars. |
| `severity` | no | `"error"` (default) blocks validity. `"warning"` is advisory. |

```json schema=form
{
  "fields": {
    "startDate": { "type": "date" },
    "endDate": { "type": "date" },
    "monthlyRent": { "type": "money" },
    "securityDeposit": { "type": "money" },
    "employmentStatus": { "type": "enum", "enum": [{ "value": "employed" }, { "value": "other" }] },
    "employerName": { "type": "text" }
  },
  "rules": {
    "endAfterStart": { "expr": "fields.endDate > fields.startDate", "message": "End date must be after start date" },
    "depositLimit": {
      "expr": "fields.securityDeposit.amount <= fields.monthlyRent.amount * 2",
      "message": "Deposit exceeds twice the monthly rent",
      "severity": "warning"
    },
    "employerGiven": {
      "expr": "fields.employmentStatus != 'employed' or isNotEmpty(fields.employerName)",
      "message": "Employer name is required when employed"
    }
  }
}
```

A rule over an unanswered field fails with its message until the field is filled ([Missing and failed values](#missing-and-failed-values)).

## Limits

| Limit | Value |
|-------|-------|
| Expression string in an artifact (condition, def value or component, rule `expr`) | 1-2000 chars |
| Rule `message` | 1-500 chars |
| Nesting of `(` and `[` | 256 levels |
| `matches` pattern / input | 512 / 10,000 chars |
| `round` digits | 0-1000 |

Exceeding an evaluation limit gives code `limit-exceeded`.

## Patterns

| Signal | Add |
|--------|-----|
| Show field X only when Y is set or selected | `visible` on X |
| Require X only when Y has a value | `required` on X |
| The same condition in three or more places | a boolean def, referenced by key |
| A total of rows | a def with `sum(…)` |
| Every row must satisfy a test | a rule with `count(list, <failing test>) == 0` |
| A relation between fields (end after start, deposit limit) | a rule |
| A soft threshold | a rule with `"severity": "warning"` |

Progressive disclosure with a shared condition in a def:

```json schema=form
{
  "fields": {
    "hasPets": { "type": "boolean", "label": "Do you have pets?", "default": false },
    "propertyAllowsPets": { "type": "boolean" },
    "petCount": { "type": "number", "visible": "petsApplicable", "required": "petsApplicable" },
    "petBreed": { "type": "text", "visible": "petsApplicable" },
    "petDeposit": { "type": "money", "visible": "petsApplicable" }
  },
  "defs": {
    "petsApplicable": { "type": "boolean", "value": "fields.hasPets == true and fields.propertyAllowsPets == true" }
  }
}
```

Naming: boolean defs start with `is` or `has` (`isHighRisk`). Computed values say what they hold (`totalIncome`). Rules say what they check (`endAfterStart`).

## SDK

In `p.form({ ... })`, `defs` and `rules` take the same objects as the JSON above. The builder adds a def with `.def(name, expression)`: a string makes a boolean def; pass `{ type, value }` for any other type.

```typescript
import { p, validateLogic } from "@paradoc/sdk";

const term = p.form()
  .name("term")
  .fields({ leaseTermMonths: { type: "number" } })
  .def("isLongTerm", "fields.leaseTermMonths >= 12")
  .def("termYears", { type: "number", value: "fields.leaseTermMonths / 12" })
  .build();

const draft = term.fill({ fields: { leaseTermMonths: 18 } });
draft.getLogicValue("isLongTerm"); // true

validateLogic(term.toJSON()); // { value } or { issues: [{ message, path, expression?, severity? }] }
```

<!-- dep:C5 -->
The builder's `.rules({ … })` takes the same object as `rules`.

`validate()` runs the schema and then the logic; `validateLogic()` runs the logic only. A circular def is an issue with severity `"warning"`. Failed defs, conditions and rules on a draft are in `getFillState()` ([filling.md § Fill state](./filling.md#fill-state)).

## The `@paradoc/expr` API

Evaluate or check an expression outside an artifact with `@paradoc/expr`, also exported as the `expr` namespace of `@paradoc/sdk`.

```typescript
import { expr } from "@paradoc/sdk"; // or: import { … } from "@paradoc/expr"

const ctx = expr.createContext(
  { fields: { age: 25 } },
  { asOf: { date: "2026-09-23", datetime: "2026-09-23T00:00:00Z" } },
);

expr.evaluateExpression("fields.age >= 18", ctx);
// { success: true, value: { kind: "boolean", value: true } }

expr.evaluateExpression("fields.missing * 2", ctx);
// { success: false, code: "missing-input", missing: ["fields.missing"], error: "Missing input: fields.missing" }

const env = expr.createTypeEnv({ "fields.age": expr.T.number });
expr.check("fields.age + fields.x", env).diagnostics;
// [{ severity: "error", code: "unknown-identifier", message: "Unknown reference: fields.x", span }]
expr.checkBooleanGate("fields.age", env).diagnostics;
// [{ code: "non-boolean-gate", message: "A gate must be boolean, got number", … }]
```

| Export | Use |
|--------|-----|
| `evaluateExpression(source, ctx)` | Parse and evaluate. Never throws. Values are tagged `{ kind, value }`; numbers are `Decimal`. |
| `createContext(data, { asOf?, hostFunctions?, registry? })` | Build a context from plain data. Without `asOf`, `today()`/`now()` fail with `missing-clock`. |
| `check(source, env)` / `checkBooleanGate(source, env)` | Type-check against a `createTypeEnv({ path: T.<type> })` environment. |
| `parse(source)` | `{ ast, errors }`. |
| `extractReferences(ast)` / `missingReferences(ast, ctx)` | The paths an expression reads, and which have no value. |
| `DEFAULT_SIGNATURES`, `buildRegistry(extra, { explicitOverrides })` | The builtin set, and a registry with host functions added. A host function must be deterministic, and its name may not collide with a builtin unless listed in `explicitOverrides`. |
| `Decimal`, `MAX_EXPRESSION_LENGTH`, `MAX_EXPRESSION_DEPTH`, `MAX_DECIMAL_DIGITS`, `MAX_DECIMAL_SCALE` | Exact arithmetic and engine limits. |

Failure codes: `missing-input`, `syntax` (the source does not parse), `type-error`, `division-by-zero`, `currency-mismatch`, `unknown-function`, `arity`, `missing-clock`, `missing-capability` (a party function with no party context), `limit-exceeded`, `host-error`.

Templates can also call host functions configured on the renderer: see [rendering.md](./rendering.md).
