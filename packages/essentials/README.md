<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=essentials" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/essentials</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=essentials)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=essentials) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas.

## Package overview

A curated collection of common business artifacts ready to use with the Paradoc SDK. Each artifact ships with its full spec and pre-built layers (markdown and PDF) bundled in — no separate downloads, no resolver setup.

## Installation

```bash
npm install @paradoc/essentials @paradoc/sdk
```

## Included artifacts

| Domain     | Import                     | Form                                                                       |
| ---------- | -------------------------- | -------------------------------------------------------------------------- |
| tax        | `w9`                       | IRS W-9 — Request for Taxpayer Identification Number                       |
| tax        | `f1099NEC`                 | IRS 1099-NEC — Nonemployee Compensation                                    |
| tax        | `f1099MISC`                | IRS 1099-MISC — Miscellaneous Information                                  |
| tax        | `f4506T`                   | IRS 4506-T — Request for Transcript of Tax Return                          |
| employment | `i9`                       | USCIS I-9 — Employment Eligibility Verification                            |
| banking    | `achBankAccountInfo`       | ACH Bank Account Information                                               |
| banking    | `achChangeForm`            | ACH Change Form                                                            |
| banking    | `achCreditAuthorization`   | ACH Credit Authorization                                                   |
| banking    | `achDebitAuthorization`    | ACH Debit Authorization                                                    |
| banking    | `achDirectDeposit`         | ACH Direct Deposit Authorization                                           |

Import by domain or from the root:

```typescript
import { w9 } from "@paradoc/essentials/tax";
import { i9 } from "@paradoc/essentials/employment";
import { achDirectDeposit } from "@paradoc/essentials/banking";

// or flat
import { w9, i9, achDirectDeposit } from "@paradoc/essentials";
```

## Usage

Fill a W-9 and render its markdown layer:

```typescript
import { w9 } from "@paradoc/essentials/tax";
import { textRenderer } from "@paradoc/sdk";

const markdown = await w9
  .fill({
    parties: {
      taxpayer: { id: "taxpayer-0", name: "Jane Q. Public" },
    },
    fields: {
      taxClassification: "individual_or_sole_proprietor",
      ssn: "123-45-6789",
      mailingAddress: {
        line1: "1 Main St",
        locality: "Springfield",
        region: "IL",
        postalCode: "62704",
        country: "US",
      },
    },
  })
  .render({ renderer: textRenderer(), layer: "markdown" });
```

Render the official PDF layer instead by swapping the renderer:

```typescript
import { pdfRenderer } from "@paradoc/sdk";

const pdf = await w9.fill(data).render({ renderer: pdfRenderer(), layer: "pdf" });
```

Each artifact's bundled resolver is applied automatically — you don't need to pass one. Validate without filling using `safeParseData`:

```typescript
const result = w9.safeParseData(rawInput);
if (result.success) {
  // result.data is fully typed
}
```

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/essentials/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Complete framework with renderers
- [`@paradoc/core`](../core) - Core builders and validation
- [`@paradoc/renderers`](../renderers) - PDF, DOCX, and Text renderers

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
