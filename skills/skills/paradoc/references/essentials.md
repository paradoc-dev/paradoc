---
name: essentials
description: Ready-made form artifacts from @paradoc/essentials (W-9, 1099-NEC, 1099-MISC, 4506-T, I-9, ACH), their exports, field ids and PDF layers
metadata:
  tags: essentials, w9, 1099, i9, ach, forms
---

# Ready-made forms (`@paradoc/essentials`)

`@paradoc/essentials` ships finished form artifacts with their Markdown and PDF layers bundled. Use the export whenever the user needs one of these forms. Author a new form only when the form is not here or the user needs another version of it.

```bash
npm install @paradoc/essentials @paradoc/sdk
```

## Exports

| Import path | Exports |
|-------------|---------|
| `@paradoc/essentials/tax` | `w9` (IRS W-9), `f1099NEC` (1099-NEC), `f1099MISC` (1099-MISC), `f4506T` (4506-T) |
| `@paradoc/essentials/employment` | `i9` (USCIS I-9) |
| `@paradoc/essentials/banking` | `achBankAccountInfo`, `achChangeForm`, `achCreditAuthorization`, `achDebitAuthorization`, `achDirectDeposit` (NACHA ACH forms) |

Everything is also exported from `@paradoc/essentials`.

## Use one

Each export is a form. Read its field ids and enum codes from `spec` before you build data:

```typescript
import { w9 } from "@paradoc/essentials/tax";

Object.keys(w9.spec.fields); // ["businessName", "taxClassification", ...]
const draft = w9.fill(data);
const pdf = await draft.render({ layer: "pdf" });
```

`paradoc data template` prints the same ids as a sample payload.

## Form-specific rules

- The 1099 forms have one PDF layer per copy: `pdfCopyA`, `pdfCopy1`, `pdfCopyB`, `pdfCopy2`. Pass `layer` to render and extract.
- A party with `partyType: "any"` (the W-9 `taxpayer`) is a person unless it carries an organization-only member such as `legalName` or `entityType`.
- The forms fill, render, extract and seal like any form: see [filling.md](./filling.md), [pdf.md](./pdf.md) and [sealing.md](./sealing.md).
