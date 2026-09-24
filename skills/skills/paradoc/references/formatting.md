---
name: formatting
description: Locale-aware presentation of artifact values with @paradoc/format. Passing a formatter to render, constructor options, every format method, safe results, selection values, and address layouts.
metadata:
  tags: formatting, locale, money, date, address, enum, rating, formatter, render
---

# Formatting

**Contents:** [Format a render](#format-a-render) · [Create a formatter](#create-a-formatter) · [Methods](#methods) · [Safe results](#safe-results) · [Value rules](#value-rules) · [Selection values](#selection-values) · [Addresses](#addresses) · [Specialize a formatter](#specialize-a-formatter)

`@paradoc/format` turns stored values into display text; stored values stay as they are. `@paradoc/sdk` re-exports all of it.

The caller chooses the presentation: pass the locale and options explicitly. The one presentation an artifact declares is a PDF layer's `format`, because it belongs to that PDF template ([pdf.md § Money](./pdf.md#money)).

## Format a render

Pass the formatter to `render()`. Every value in the layer prints with it.

```typescript
import { createFormatter, p } from "@paradoc/sdk";

const invoice = p.form({
  name: "invoice",
  fields: { total: { type: "money" }, due: { type: "date" } },
  layers: { text: { kind: "inline", mimeType: "text/plain", text: "Total: {{fields.total}}, due {{fields.due}}" } },
});

const formatter = createFormatter({ locale: "de-DE" });
const draft = invoice.fill({ fields: { total: { amount: 1500.5, currency: "EUR" } } });

await draft.render({ layer: "text", formatter });
// "Total: 1.500,50 €, due "
```

Other render options, such as `progressive` for missing values, are in [rendering.md § Render options](./rendering.md#render-options).

## Create a formatter

`createFormatter(options)` returns an immutable formatter. `defaultFormatter` is one with no options: `en-US`, UTC, Gregorian.

| Option | Default | Description |
|--------|---------|-------------|
| `locale` | `"en-US"` | BCP 47 locale, such as `de-DE` |
| `unsupportedLocale` | `"error"` | `"error"` throws `FormatConfigurationError` at construction for a locale the runtime lacks. `"fallback"` uses `fallbackLocale`. |
| `fallbackLocale` | none | Locale for an unsupported runtime locale, and for package messages a supported locale lacks |
| `timeZone` | `"UTC"` | Time zone for instants (datetimes) |
| `calendar` | `"gregory"` | Calendar for dates and datetimes |
| `numberingSystem` | the locale's | Digits for numbers and dates, such as `arab` |
| `money`, `number`, `percentage`, `date`, `datetime`, `time`, `duration`, `address`, `phone`, `party`, `boolean`, `enum`, `multiselect`, `rating`, ... | none | Base options for each value kind, the same objects the methods take |
| `overrides` | none | Replacement implementations per kind; see [Specialize a formatter](#specialize-a-formatter) |
| `messages` | none | Extra package messages keyed by locale |

Use a precise locale. The built-in messages cover `en-US`, `en-GB`, `de-DE`, `fr-FR` and `ar-SA`. A region label such as `EU` is not a policy: Intl reads `EU` as Basque.

## Methods

Each value kind has a strict method and a safe method. The strict one returns text or throws `FormatError`. The safe one returns a [result](#safe-results).

| Kind | Strict | Safe | Options |
|------|--------|------|---------|
| number | `formatNumber` | `safeFormatNumber` | Intl number options |
| money | `formatMoney` | `safeFormatMoney` | Intl number options, `currencyDisplay` (including `"none"`), `currencySign` |
| percentage | `formatPercentage` | `safeFormatPercentage` | Intl number options |
| date | `formatDate` | `safeFormatDate` | Intl date options, `timeZone`, `calendar` |
| datetime | `formatDatetime` | `safeFormatDatetime` | Same |
| time | `formatTime` | `safeFormatTime` | Same |
| duration | `formatDuration` | `safeFormatDuration` | Intl number options |
| address | `formatAddress` | `safeFormatAddress` | `layout`, `countryLayouts` |
| phone | `formatPhone` | `safeFormatPhone` | `extensionLabel` |
| person | `formatPerson` | `safeFormatPerson` | none |
| organization | `formatOrganization` | `safeFormatOrganization` | none |
| party | `formatParty` | `safeFormatParty` | `partyType` for a party with only `name` |
| coordinate | `formatCoordinate` | `safeFormatCoordinate` | Intl number options |
| bbox | `formatBbox` | `safeFormatBbox` | Intl number options |
| identification | `formatIdentification` | `safeFormatIdentification` | Intl date options |
| attachment | `formatAttachment` | `safeFormatAttachment` | none |
| signature | `formatSignature` | `safeFormatSignature` | Intl date options |
| boolean | `formatBoolean` | `safeFormatBoolean` | `trueLabel`, `falseLabel` |
| enum | `formatEnum` | `safeFormatEnum` | `options`, `unknownOption` |
| multiselect | `formatMultiselect` | `safeFormatMultiselect` | `options`, `unknownOption`, `listType`, `listStyle` |
| rating | `formatRating` | `safeFormatRating` | `max`, `display` |

Every method also takes a per-call `locale` and `numberingSystem`. For a kind known only at runtime, call `formatter.format(kind, value)` or `formatter.safeFormat(kind, value)`. The standalone `formatValue(kind, value)` and `safeFormatValue(kind, value)` use `defaultFormatter`, as do the standalone exports named after each method.

## Safe results

```typescript
formatter.safeFormatMoney({ amount: 10 });
// { success: false, status: "incomplete",
//   issues: [{ code: "missing_member", path: "currency", kind: "money",
//              message: "Money currency is required; no default currency is applied." }] }
```

| `status` | `success` | Meaning |
|----------|-----------|---------|
| `formatted` | `true` | `value` holds the text |
| `missing` | `false` | No value |
| `incomplete` | `false` | A composite lacks a required member |
| `invalid` | `false` | The value or an option is wrong, such as `2026-13-01`, an enum value no option declares, or `timeZone: "Nope/Zone"` (code `invalid_options`) |
| `unsupported` | `false` | The input is fine but cannot print this way: a rating with no `max`, a missing package message, a locale the runtime lacks (`unsupported_locale`) |
| `error` | `false` | An unexpected failure |

A failed result carries `issues`: `{ code, message, path?, kind?, cause? }`.

## Value rules

The stored shape of each value is in [fields.md](./fields.md).

| Kind | Rule |
|------|------|
| money | Always carries its currency. A bare amount gets no default currency. |
| percentage | Percentage points: `8.25` prints as `8.25%`. |
| date | A calendar date. The time zone never shifts it. |
| datetime | A value with `Z` or an offset is an instant, printed in `timeZone`. |
| time | A clock value. The host time zone never changes it. |
| duration | ISO 8601. Zero components are left out. |

## Selection values

Pass what the field declares: its `enum` options, its rating `max`.

```typescript
const services = [
  { value: "plumbing", label: "Plumbing" },
  { value: "wiring", label: "Wiring" },
];

formatter.formatBoolean(true); // "Ja" (de-DE)
formatter.formatEnum("wiring", { options: services }); // "Wiring"
formatter.formatMultiselect(["plumbing", "wiring"], { options: services }); // "Plumbing und Wiring"
formatter.formatRating(4, { max: 5 }); // "4 von 5"
```

| Option | Values | Effect |
|--------|--------|--------|
| `trueLabel`, `falseLabel` | string | Replace the locale's yes and no words |
| `unknownOption` | `"error"` (default), `"value"` | A value no option declares is `invalid`, or prints as itself |
| `listType` | `"conjunction"` (default), `"disjunction"`, `"unit"` | "and", "or", or a plain unit list |
| `listStyle` | `"long"` (default), `"short"`, `"narrow"` | Verbosity of the joiner |
| `max` | number | The rating scale. Without it the rating is `unsupported`. |
| `display` | `"scale"` (default), `"value"` | "4 of 5", or "4" |

Renderers pass a field's options and `max` for you. A rating field without `max` renders as a plain number.

## Addresses

Country layouts exist for `US`, `GB`, `DE`, `FR` and `SA`. Another country is `unsupported` unless you choose a layout:

```typescript
const tokyo = { line1: "1-1 Chiyoda", locality: "Tokyo", region: "Tokyo", postalCode: "100-0001", country: "JP" };

formatter.safeFormatAddress(tokyo).status; // "unsupported"
formatter.formatAddress(tokyo, { layout: "generic" }); // "1-1 Chiyoda, Tokyo, Tokyo, 100-0001, JP"
```

`countryLayouts` maps an ISO 3166-1 alpha-2 code to your own `(address, context) => string`. The address country is independent of the formatter locale.

## Specialize a formatter

`compose(options)` and `withOverrides(overrides)` return a new formatter. The original is unchanged.

```typescript
const amountOnly = formatter.compose({ money: { currencyDisplay: "none" } });
amountOnly.formatMoney({ amount: 12000, currency: "USD" }); // "12.000,00"

const tagged = formatter.withOverrides({
  money: (value, options, context) => `${context.delegate(value, options)} (net)`,
});
tagged.formatMoney({ amount: 1, currency: "EUR" }); // "1,00 € (net)"
```

`currencyDisplay: "none"` keeps the currency's fraction digits (two for USD, none for JPY) unless you set digits. An override calls `context.delegate` to reach the implementation it replaces.

A kind that formats through another kind, such as a signature's date or a rating's number, passes only its own options: `number: { maximumFractionDigits: 0 }` does not round a rating. An override of the inner kind still applies.
