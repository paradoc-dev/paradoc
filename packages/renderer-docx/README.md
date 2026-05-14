<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=renderer_docx" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/renderer-docx</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=renderer_docx)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=renderer_docx) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Renders Paradoc documents to DOCX (Microsoft Word) format with automatic field type detection and serialization.

- **Automatic field serialization** - Detects field types (Money, Person, Phone, Address, Organization) from form schema and automatically formats them
- **Template-based rendering** - Use DOCX files as templates with Handlebars-style placeholders
- **Binary output** - Returns Uint8Array for direct file writing or streaming
- **Type-safe** - Full TypeScript support with Paradoc core types

## Installation

```bash
npm install @paradoc/renderer-docx
```

## Usage

### Direct Rendering with renderDocx()

Render DOCX templates directly with automatic field serialization:

```typescript
import { renderDocx } from "@paradoc/renderer-docx";
import fs from "node:fs";
import { petAddendumForm } from "./forms/pet-addendum";

const template = fs.readFileSync("pet-addendum.docx");

const output = await renderDocx(
  new Uint8Array(template),
  {
    petName: {
      firstName: "Fluffy",
      lastName: "Whiskers",
      name: "Fluffy Whiskers",
    },
    monthlyFee: {
      amount: 100,
      currency: "USD",
    },
  },
  {},
  petAddendumForm // Automatic field type detection and serialization
);

// output is Uint8Array - write to file
fs.writeFileSync("output.docx", output);
```

**`renderDocx()` Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | `Uint8Array` | Yes | DOCX template as binary |
| `data` | `Record<string, unknown>` | Yes | Data object to populate template |
| `options` | `DocxRenderOptions` | No | DOCX-specific rendering options (cmdDelimiter, failFast, processLineBreaks) |
| `form` | `Form` | No | Form schema for automatic field type detection and serialization |
| `serializers` | `SerializerRegistry` | No | Custom serializer registry (defaults to USA serializers) |

**Returns:** `Promise<Uint8Array>` - Rendered DOCX as binary

### Using the Form Builder API

Render DOCX using the Paradoc builder pattern with method chaining:

```typescript
import { docxRenderer } from "@paradoc/renderer-docx";
import { createFsResolver } from "@paradoc/resolvers/fs";
import { petAddendumForm } from "./forms/pet-addendum";

const resolver = createFsResolver({ root: "./templates" });

const output = await petAddendumForm
  .fill({
    fields: {
      petName: {
        firstName: "Fluffy",
        lastName: "Whiskers",
        name: "Fluffy Whiskers",
      },
      monthlyFee: {
        amount: 100,
        currency: "USD",
      },
    },
  })
  .render({
    renderer: docxRenderer,
    layer: "docx",
    resolver,
  });

// output is Uint8Array
```

**`docxRenderer` Instance:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Renderer identifier: "docx" |
| `render()` | `function` | Async render function accepting RenderRequest |

**Form `.render()` Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `renderer` | `ParadocRenderer` | Yes | Renderer instance (`docxRenderer`) |
| `layer` | `string` | Yes | Name of the template layer to render |
| `resolver` | `FileResolver` | No | File resolver for loading template files |

**Returns:** `Promise<Uint8Array>` - Rendered DOCX as binary

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/renderer-docx/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK
- [`@paradoc/renderers`](../renderers) - All renderers in one package

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.

## Acknowledgments

Built with these excellent libraries:

- [docx-templates](https://github.com/guigrpa/docx-templates) - Template-based DOCX generation
