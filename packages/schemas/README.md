<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=schemas" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/schemas</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=schemas)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=schemas) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Zod schemas for Paradoc artifacts, forms, documents, and primitives.

## Installation

```bash
npm install @paradoc/schemas
```

## Usage

```typescript
import { FormSchema, DocumentSchema, BundleSchema } from "@paradoc/schemas";

// Validate form data
const result = FormSchema.safeParse(myFormData);
if (!result.success) {
  console.log(result.error.issues);
}

// Parse and validate (throws on error)
const form = FormSchema.parse(myFormData);
```

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/schemas/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.

## Acknowledgments

Built with these excellent libraries:

- [Zod](https://github.com/colinhacks/zod) - TypeScript-first schema validation
