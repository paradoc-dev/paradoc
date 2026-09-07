# @paradoc/format

`@paradoc/format` presents structured Paradoc values as human-readable text. It keeps display policy separate from stored values, localized input parsing, currency conversion, and artifact validation.

The formatter presents numbers, money, percentage points, people, organizations, parties, phones, and postal addresses. It is immutable and reusable, so repeated calls under one effective policy reuse bounded `Intl.NumberFormat` caches.

```ts
import { createFormatter } from '@paradoc/format'

const formatter = createFormatter({ locale: 'de-DE' })

formatter.formatNumber(1234567.89) // '1.234.567,89'
formatter.formatMoney({ amount: 1500.5, currency: 'USD' }) // '1.500,50 $'
formatter.formatPercentage(8.25) // '8,25 %'
```

Contact values use the same standalone and dynamic operations:

```ts
formatter.formatPerson({ firstName: 'Jane', lastName: 'Smith' }) // 'Jane Smith'
formatter.formatPhone({ number: '+442071838750', extension: '42' }) // '+442071838750 ext. 42'
formatter.formatAddress({
  line1: '10 Downing Street',
  locality: 'London',
  region: 'Greater London',
  postalCode: 'SW1A 2AA',
  country: 'GB',
}) // '10 Downing Street, London, Greater London, SW1A 2AA, GB'
```

Address country and document locale are independent. The default `layout: 'country'` policy provides layouts for US, GB, DE, FR, and SA and returns an `unsupported` result for another country. Select `layout: 'generic'` when a component-preserving layout is appropriate, or provide a `countryLayouts` object whose ISO country-code keys map to formatter functions for another country. Party values with only the shared `name` member are ambiguous; use `partyType: 'person'` or provide a distinguishing person or organization member.

Money always supplies its currency. A bare amount is never assigned a default currency. Percentage values use Paradoc's percentage-point scale, so `8.25` means `8.25%`, not `825%`.

Strict methods return text and throw a `FormatError` for missing, incomplete, invalid, unsupported, or unexpected values. Use the safe methods when a progressive flow needs structured diagnostics:

```ts
const result = formatter.safeFormatMoney({ amount: 10 })
// { success: false, status: 'incomplete', issues: [...] }
```

The safe methods are named `safeFormatMoney`, `safeFormatNumber`, `safeFormatPercentage`, `safeFormatAddress`, `safeFormatPhone`, `safeFormatPerson`, `safeFormatOrganization`, and `safeFormatParty`. Dynamic callers can use `formatValue(kind, value)` or `safeFormatValue(kind, value)`. Value families that have not been implemented yet return `unsupported` rather than a fake successful string.

Locale, numbering-system, calendar, and timezone choices are independent. The default locale is `en-US`; temporal defaults are retained as explicit `UTC` and Gregorian settings for the temporal formatter slice. An unsupported locale fails at construction unless `unsupportedLocale: 'fallback'` and an explicit `fallbackLocale` are provided.

```ts
const amountOnly = formatter.compose({
  money: { currencyDisplay: 'none', minimumFractionDigits: 2 },
})

amountOnly.formatMoney({ amount: 1500.5, currency: 'USD' }) // '1.500,50'
```

`compose` and `withOverrides` return independent formatter instances. Overrides can delegate to the previous implementation through the third callback argument, without recursively invoking themselves.
