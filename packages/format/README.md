# @paradoc/format

`@paradoc/format` presents structured Paradoc values as human-readable text. It keeps display policy separate from stored values, localized input parsing, currency conversion, and artifact validation.

The first release provides numbers, money, and percentage points. The formatter is immutable and reusable, so repeated calls under one effective policy reuse bounded `Intl.NumberFormat` caches.

```ts
import { createFormatter } from '@paradoc/format'

const formatter = createFormatter({ locale: 'de-DE' })

formatter.formatNumber(1234567.89) // '1.234.567,89'
formatter.formatMoney({ amount: 1500.5, currency: 'USD' }) // '1.500,50 $'
formatter.formatPercentage(8.25) // '8,25 %'
```

Money always supplies its currency. A bare amount is never assigned a default currency. Percentage values use Paradoc's percentage-point scale, so `8.25` means `8.25%`, not `825%`.

Strict methods return text and throw a `FormatError` for missing, incomplete, invalid, unsupported, or unexpected values. Use the safe methods when a progressive flow needs structured diagnostics:

```ts
const result = formatter.safeFormatMoney({ amount: 10 })
// { success: false, status: 'incomplete', issues: [...] }
```

The safe methods are named `safeFormatMoney`, `safeFormatNumber`, and `safeFormatPercentage`. Dynamic callers can use `formatValue(kind, value)` or `safeFormatValue(kind, value)`. Value families that have not been implemented yet return `unsupported` rather than a fake successful string.

Locale, numbering-system, calendar, and timezone choices are independent. The default locale is `en-US`; temporal defaults are retained as explicit `UTC` and Gregorian settings for the temporal formatter slice. An unsupported locale fails at construction unless `unsupportedLocale: 'fallback'` and an explicit `fallbackLocale` are provided.

```ts
const amountOnly = formatter.compose({
  money: { currencyDisplay: 'none', minimumFractionDigits: 2 },
})

amountOnly.formatMoney({ amount: 1500.5, currency: 'USD' }) // '1.500,50'
```

`compose` and `withOverrides` return independent formatter instances. Overrides can delegate to the previous implementation through the third callback argument, without recursively invoking themselves.
