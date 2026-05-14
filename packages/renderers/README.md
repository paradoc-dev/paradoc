<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=renderers" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/renderers</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=renderers)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=renderers) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Umbrella package that re-exports all Paradoc renderers for convenient installation and usage.

- **All-in-one** - Single package containing all renderers
- **Batteries included** - support for text, HTML, Markdown, DOCX, PDF
- **Type-safe** - Full TypeScript support

## Installation

```bash
npm install @paradoc/renderers
```

## Usage

Import desired renderer and pass to the render method's `renderer` configuration. Included renderers are `textRenderer`, `docxRenderer`, and `pdfRenderer`.

```typescript
import { para } from "@paradoc/sdk";
import { textRenderer } from "@paradoc/renderers";

const textString = await para
  .form({
    name: "my-form",
    title: "My Form",
    // ...
    fields: {
      name: { type: "string", required: true },
    },
    layers: {
      markdown: {
        kind: "inline",
        mimeType: "text/markdown",
        text: "Hello {{fields.name}}",
      },
    },
  })
  .fill({
    fields: { name: "Alice" },
  })
  .render({
    renderer: textRenderer, // Plug in renderer
    layer: "markdown", // Specify target layer
  });

console.log(textString); // => "Hello Alice"
```

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/renderers/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK
- [`@paradoc/renderer-text`](../renderer-text) - Text Renderer
- [`@paradoc/renderer-docx`](../renderer-docx) - DOCX Renderer
- [`@paradoc/renderer-pdf`](../renderer-pdf) - PDF Renderer

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.
