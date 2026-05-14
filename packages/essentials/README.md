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

A curated collection of ready-to-use Paradoc artifacts for commonly needed business forms. Install the package, import an artifact, fill it with data, and render it — no manual schema authoring required.

- **IRS** — W-9, W-8BEN, SS-4, 4506-T, 1099-NEC, 1099-MISC
- **NACHA** — ACH debit authorization, ACH credit authorization, ACH change, direct deposit, bank account info
- **USCIS** — I-9
- **HIPAA** — notices, authorizations
- **ACORD** — insurance forms
- **Business** — NDA and other general business agreements

Each artifact ships with pre-built layers (markdown, PDF where available) so you can render them immediately.

## Installation

```bash
npm install @paradoc/essentials
```

## Usage

```typescript
import { irs } from "@paradoc/essentials";

// Access the W-9 artifact
const w9 = irs.w9;

// Fill with data and render
const filled = w9.fill({
  fields: {
    name: "Jane Doe",
    taxClassification: "individual",
    // ...
  },
});
```

## Included artifacts

| Category | Artifacts |
|----------|-----------|
| IRS | W-9, W-8BEN, SS-4, 4506-T, 1099-NEC, 1099-MISC |
| NACHA | ACH debit authorization, ACH credit authorization, ACH change, direct deposit, bank account info |
| USCIS | I-9 |
| HIPAA | *(coming soon)* |
| ACORD | *(coming soon)* |
| Business | NDA |

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/essentials/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/core`](../core) - Core builders and validation
- [`@paradoc/sdk`](../sdk) - Complete framework with renderers
- [`@paradoc/types`](../types) - TypeScript utilities and types
- [`@paradoc/schemas`](../schemas) - JSON Schema definitions
- [`@paradoc/renderers`](../renderers) - All renderers (PDF, DOCX, Text)

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
