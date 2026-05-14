<p align="center">
  <a href="https://paradoc.dev?utm_source=github&utm_medium=renderer_text" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://assets.paradoc.dev/logo-400x400.png" type="image/png">
      <img src="https://assets.paradoc.dev/logo-400x400.png" height="64" alt="Paradoc logo">
    </picture>
  </a>
  <br />
</p>

<h1 align="center">@paradoc/renderer-text</h1>

<div align="center">

[![Paradoc documentation](https://img.shields.io/badge/Documentation-Paradoc-red.svg)](https://docs.paradoc.dev?utm_source=github&utm_medium=renderer_text)
[![Follow on Twitter](https://img.shields.io/twitter/follow/paradochq?style=social)](https://twitter.com/intent/follow?screen_name=paradochq)

</div>

[Paradoc](https://paradoc.dev?utm_source=github&utm_medium=renderer_text) is **documents as code**. It lets developers and AI agents define, validate, and render business documents using typed, composable schemas. This eliminates template drift, broken mappings, and brittle glue code — while giving AI systems a reliable document layer they can safely read, reason over, and generate against in production workflows.

## Package overview

Renders Paradoc documents to text-based formats including plain text, Markdown, and HTML with automatic field type detection and serialization.

- **Automatic field serialization** - Detects field types (Money, Person, Phone, Address, Organization) from form schema and automatically formats them
- **Multiple output formats** - Supports any text-based format: plain text, Markdown, HTML, or custom formats
- **Template-based rendering** - Use Handlebars templates for dynamic text generation
- **Custom serializers** - Use locale-specific or custom serializer registries for formatting
- **Type-safe** - Full TypeScript support with Paradoc core types

## Installation

```bash
npm install @paradoc/renderer-text
```

## Usage

### Method 1: Direct rendering with renderText()

Render templates directly using the exported renderText function:

```typescript
import { renderText } from "@paradoc/renderer-text";
import { leaseForm } from "./forms/lease-agreement";

const output = renderText({
  template: `
# Lease Agreement

**Tenant:** {{tenantName}}
**Monthly Rent:** {{monthlyRent}}
  `,
  data: {
    tenantName: {
      firstName: "Sarah",
      lastName: "Johnson",
      name: "Sarah Johnson",
    },
    monthlyRent: {
      amount: 1500,
      currency: "USD",
    },
  },
  form: leaseForm, // Automatic field type detection and serialization
});

console.log(output);
// Renders with automatic formatting:
// **Tenant:** Sarah Johnson
// **Monthly Rent:** $1,500.00
```

**`renderText()` Parameters:**

| Parameter     | Type                      | Required | Description                                                      |
| ------------- | ------------------------- | -------- | ---------------------------------------------------------------- |
| `template`    | `string`                  | Yes      | Handlebars template string                                       |
| `data`        | `Record<string, unknown>` | Yes      | Data object to populate the template                             |
| `form`        | `Form`                    | No       | Form schema for automatic field type detection and serialization |
| `serializers` | `SerializerRegistry`      | No       | Custom serializer registry (defaults to USA serializers)         |

**Returns:** `string` - The rendered output

### Method 2: Use textRenderer as plug-in to Form instance render method:

Render forms using the Paradoc builder pattern:

```typescript
import { para } from "@paradoc/sdk";
import { textRenderer } from "@paradoc/renderer-text";

const leaseForm = para.form({
  // form defnition...
});

const output = await leaseForm
  .fill({
    fields: {
      tenantName: {
        firstName: "Sarah",
        lastName: "Johnson",
        name: "Sarah Johnson",
      },
      monthlyRent: {
        amount: 1500,
        currency: "USD",
      },
    },
  })
  .render({
    renderer: textRenderer(), // <-- plug in textRenderer
    layer: "markdown",
    resolver, // File resolver for loading template layers
  });

console.log(output);
// Renders with automatic formatting applied
```

**`textRenderer()` Options:**

| Parameter     | Type                 | Required | Description                                              |
| ------------- | -------------------- | -------- | -------------------------------------------------------- |
| `serializers` | `SerializerRegistry` | No       | Custom serializer registry (defaults to USA serializers) |

## Changelog

View the [Changelog](https://github.com/paradoc-dev/paradoc/blob/main/packages/renderer-text/CHANGELOG.md) for updates.

## Related packages

- [`@paradoc/serialization`](../serialization) - Field type detection and serialization utilities
- [`@paradoc/sdk`](../sdk) - Paradoc framework SDK
- [`@paradoc/renderers`](../renderers) - All renderers in one package

## Contributing

We're open to all community contributions! If you'd like to contribute in any way, please read our [contribution guidelines](https://github.com/paradoc-dev/paradoc/blob/main/CONTRIBUTING.md) and [code of conduct](https://github.com/paradoc-dev/paradoc/blob/main/CODE_OF_CONDUCT.md).

## License

This project is licensed under the MIT license.

See [LICENSE](https://github.com/paradoc-dev/paradoc/blob/main/LICENSE) for more information.

## Acknowledgments

Built with these excellent libraries:

- [Handlebars](https://handlebarsjs.com/) - Minimal templating on steroids
