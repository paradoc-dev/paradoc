---
name: formatting
description: Locale-aware presentation of structured artifact values through @paradoc/format
metadata:
  tags: formatting, money, address, phone, person, locale
---

# Formatting Artifact Values

Use `@paradoc/format` to present structured values. Stored values remain unchanged.

```typescript
import { createFormatter } from "@paradoc/format";

const formatter = createFormatter({ locale: "de-DE" });
formatter.formatMoney({ amount: 1500.5, currency: "EUR" });
formatter.formatDate("2026-09-07");
```

ALWAYS use a precise locale. Initial documented locales are `en-US`, `en-GB`, `de-DE`, `fr-FR`, and `ar-SA`. NEVER use geographic group labels such as `EU` or `AR` as locale policy.

Money MUST include its currency. Percentage input uses percentage points: `8.25` means `8.25%`. Address country is independent of document locale.

Strict methods return text or throw `FormatError`. Use `safeFormatMoney`, `safeFormatAddress`, and the other `safeFormat*` methods when missing, incomplete, invalid, unsupported, and unexpected outcomes must remain distinguishable.

Compose an immutable formatter for specialized presentation:

```typescript
const amountOnly = formatter.compose({
  money: {
    currencyDisplay: "none",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
});
```

Pass one formatter to the whole render:

```typescript
import { renderLayer } from "@paradoc/render";

const bytes = await filled.render({
  layer: "pdf",
  renderer: renderLayer({ formatter }),
});
```

DO NOT select formatting from artifact metadata. The caller MUST pass locale and custom presentation policy explicitly.
