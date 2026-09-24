# @paradoc/format

`@paradoc/format` presents structured Paradoc values as human-readable text. It keeps display policy separate from stored values, localized input parsing, currency conversion, and artifact validation.

The formatter presents numbers, money, percentage points, people, organizations, parties, phones, postal addresses, coordinates, bounding boxes, identifications, attachments, signatures, dates, datetimes, times, ISO 8601 durations, and the selection values a form field carries: booleans, single choices, multiple choices, and ratings. It is immutable and reusable, so repeated calls under one effective policy reuse bounded Intl formatter caches.

```ts
import { createFormatter } from '@paradoc/format'

const formatter = createFormatter({ locale: 'de-DE' })

formatter.formatNumber(1234567.89) // '1.234.567,89'
formatter.formatMoney({ amount: 1500.5, currency: 'USD' }) // '1.500,50 $'
formatter.formatPercentage(8.25) // '8,25 %'
```

Contact and capture values use the same standalone and dynamic operations. This block uses an `en-US` formatter:

```ts
const us = createFormatter({ locale: 'en-US' })

us.formatPerson({ firstName: 'Jane', lastName: 'Smith' }) // 'Jane Smith'
us.formatPhone({ number: '+442071838750', extension: '42' }) // '+442071838750 ext. 42'
us.formatAddress({
  line1: '10 Downing Street',
  locality: 'London',
  region: 'Greater London',
  postalCode: 'SW1A 2AA',
  country: 'GB',
}) // '10 Downing Street, London, Greater London, SW1A 2AA, GB'

us.formatCoordinate({ lat: 40.7128, lon: -74.006 }) // '40.7128; -74.006'
us.formatBbox({
  southWest: { lat: 40.4774, lon: -74.2591 },
  northEast: { lat: 40.9176, lon: -73.7004 },
}) // '40.4774; -74.2591 | 40.9176; -73.7004'
us.formatIdentification({
  type: 'passport',
  number: 'A1',
  issueDate: '2020-01-15',
}) // 'passport: A1 (issued Jan 15, 2020)'
us.formatAttachment({ name: 'contract.pdf', mimeType: 'application/pdf' }) // 'contract.pdf (application/pdf)'
us.formatSignature({ timestamp: '2026-09-04T15:30:00Z', method: 'drawn' }) // 'Signature (drawn) on Sep 4, 2026'
```

Coordinates use `latitude; longitude`; bounding boxes use `southWest | northEast`. The semicolon and pipe separators remain unambiguous when a locale uses a comma as its decimal separator. Coordinate values default to up to nine fractional digits and accept the same number precision options as `formatNumber`.

Address country and document locale are independent. The default `layout: 'country'` policy provides layouts for US, GB, DE, FR, and SA and returns an `unsupported` result for another country. Select `layout: 'generic'` when a component-preserving layout is appropriate, or provide a `countryLayouts` object whose ISO country-code keys map to formatter functions for another country. Party values with only the shared `name` member are ambiguous; use `partyType: 'person'` or provide a distinguishing person or organization member.

Money always supplies its currency. A bare amount is never assigned a default currency. Percentage values use Paradoc's percentage-point scale, so `8.25` means `8.25%`, not `825%`.

Temporal values keep their declared meaning. A plain `YYYY-MM-DD` date is a calendar date and is never shifted by timezone. A `Date` object and a datetime string with `Z` or a numeric offset are instants and use the configured `timeZone`; an offsetless datetime string is a local calendar/clock value and stays unchanged. Times of day are formatted as clock values in UTC so the host timezone never changes them. All temporal formatters default to Gregorian calendar, UTC for instants, and the selected locale's numbering system. Per-call options can choose a supported `calendar`, `numberingSystem`, `timeZone`, or Intl precision option.

Durations use Paradoc's canonical ISO 8601 syntax (`P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S`, with fractional seconds allowed). Zero components are omitted and a zero duration is shown as zero seconds. Duration components display with up to nine fractional digits by default; set `maximumFractionDigits` or related Intl number options to choose a different display precision without changing the stored duration. Duration unit labels are supplied for the initial English, German, French, and Arabic resources, and multiple components use the runtime's standard unit-list conventions. Additional locales must provide `duration.<unit>.<plural-category>` messages, such as `duration.day.one: '{value} day'`, or explicitly choose a configured `fallbackLocale` for package messages. The requested locale still controls number and list formatting when a message fallback is used. Without a supplied fallback language, missing package messages return `unsupported`.

Selection values are presented with what the field declares. A boolean prints the locale's own yes and no words, which `trueLabel` and `falseLabel` replace. An enum and a multiselect print the label of the option that carries the value; a value no option declares is `invalid`, unless `unknownOption: 'value'` explicitly prints it as itself. A multiselect joins those labels with the locale's own list conjunction and separator, in the locale's direction; `listType` (`conjunction`, `disjunction`, `unit`) and `listStyle` (`long`, `short`, `narrow`) choose the relation and its verbosity. A rating prints with the scale it was given on.

```ts
const services = [{ value: 'plumbing', label: 'Plumbing' }, { value: 'wiring', label: 'Wiring' }]

formatter.formatBoolean(true) // 'Ja' for de-DE
formatter.formatEnum('wiring', { options: services }) // 'Wiring'
formatter.formatMultiselect(['plumbing', 'wiring'], { options: services }) // 'Plumbing und Wiring' for de-DE
formatter.formatRating(4, { max: 5 }) // '4 von 5' for de-DE
```

Two selection presentations can be unavailable rather than wrong, and both return an `unsupported` result the caller decides about. A rating with no `max` has no scale to print; a runtime whose locale data carries no list conjunction cannot join a multiselect. Paradoc's renderers fall back to the plain number and to a comma join respectively, and keep the formatter's outcome on the value. The fallback join uses a plain comma on purpose: it only runs when the runtime holds no list data for the locale, so there is no locale-correct separator left to use.

Strict methods return text and throw a `FormatError` for missing, incomplete, invalid, unsupported, or unexpected values. Use the safe methods when a progressive flow needs structured diagnostics:

```ts
const result = formatter.safeFormatMoney({ amount: 10 })
// { success: false, status: 'incomplete', issues: [...] }
```

The safe methods are named `safeFormatMoney`, `safeFormatNumber`, `safeFormatPercentage`, `safeFormatAddress`, `safeFormatPhone`, `safeFormatPerson`, `safeFormatOrganization`, `safeFormatParty`, `safeFormatCoordinate`, `safeFormatBbox`, `safeFormatIdentification`, `safeFormatAttachment`, `safeFormatSignature`, `safeFormatDate`, `safeFormatDatetime`, `safeFormatTime`, `safeFormatDuration`, `safeFormatBoolean`, `safeFormatEnum`, `safeFormatMultiselect`, and `safeFormatRating`. Dynamic callers can use `formatValue(kind, value)` or `safeFormatValue(kind, value)`. A kind the formatter does not know returns `unsupported` with the code `unknown_kind`.

A bad option is `invalid` with the code `invalid_options`, like a bad value: a malformed locale, an unknown timezone, calendar, or numbering system, or an Intl option out of range. `unsupported` means the input is right and the runtime or the resources fall short: a locale the runtime has no data for (`unsupported_locale`), a missing package message (`missing_message`), or a country with no address layout (`unsupported_country_layout`).

A value family that formats through another kind, such as a signature's date, a bounding box's corners, a rating's number, or a multiselect's labels, passes only its own options. The other kind's formatter-level options do not apply, so `number: { maximumFractionDigits: 0 }` does not round a rating. Overrides of the other kind still apply.

Locale, numbering-system, calendar, and timezone choices are independent. The default locale is `en-US`, the default timezone `UTC`, and the default calendar Gregorian. An unsupported runtime locale fails at construction unless `unsupportedLocale: 'fallback'` and an explicit `fallbackLocale` are provided. `fallbackLocale` also supplies package-authored messages, for every value family, when the requested runtime locale is supported but has no matching messages; it does not change the requested locale used for Intl numbers, dates, times, or lists.

```ts
const amountOnly = formatter.compose({
  money: { currencyDisplay: 'none' },
})

amountOnly.formatMoney({ amount: 1500.5, currency: 'USD' }) // '1.500,50'
```

`currencyDisplay: 'none'` drops the symbol and keeps the currency's fraction digits (two for USD, none for JPY) unless you set digits.

`compose` and `withOverrides` return independent formatter instances. Overrides can delegate to the previous implementation through the third callback argument, without recursively invoking themselves.

`cacheStats()` reports the size, hits, misses, and limit of each bounded cache: `number`, `money`, `percentage`, `date`, `datetime`, `time`, `timeZone`, `duration`, `durationPlural`, `durationList`, and `selectionList`. `cacheSize` (default 64, from 1 to 256) bounds each one; the least recently used entry is dropped first.
