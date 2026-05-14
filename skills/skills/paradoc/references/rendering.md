---
name: rendering
description: Rendering artifacts to text, PDF, DOCX — SDK render API, CLI render command, resolvers, bindings, custom serializers
metadata:
  tags: rendering, renderer, text, pdf, docx, markdown, html, resolvers, render
---

# Rendering

**Contents:** [SDK rendering](#sdk-rendering) · [CLI rendering](#cli-rendering) · [Automatic field serialization](#automatic-field-serialization) · [Resolvers](#resolvers) · [PDF inspection](#inspecting-pdf-fields)

Paradoc renders artifacts to text (Markdown / HTML / plain text), PDF, and DOCX. ALWAYS validate before rendering. Forms without data produce empty output — ALWAYS fill / pass `--data`.

## SDK Rendering

### Installation

```bash
npm install @paradoc/renderer-text @paradoc/renderer-pdf @paradoc/renderer-docx
# or via the umbrella
npm install @paradoc/renderers
```

### Pattern 1: form.fill().render() (recommended)

```typescript
import { textRenderer } from "@paradoc/renderer-text";
import { pdfRenderer } from "@paradoc/renderer-pdf";
import { docxRenderer } from "@paradoc/renderer-docx";
import { createFsResolver } from "@paradoc/resolvers";

const resolver = createFsResolver({ root: process.cwd() });

// Text / Markdown / HTML
const text = await form.fill(data).render({
  renderer: textRenderer(),
  resolver,
  layer: "markdown",
});

// PDF (returns Uint8Array)
const pdf = await form.fill(data).render({
  renderer: pdfRenderer(),
  resolver,
  layer: "pdf",
});

// DOCX (returns Uint8Array)
const docx = await form.fill(data).render({
  renderer: docxRenderer(),
  resolver,
  layer: "docx",
});

import fs from "node:fs";
fs.writeFileSync("output.pdf", pdf);
fs.writeFileSync("output.docx", docx);
```

### Pattern 2: direct render functions

```typescript
import { renderText } from "@paradoc/renderer-text";
import { renderPdf } from "@paradoc/renderer-pdf";
import { renderDocx } from "@paradoc/renderer-docx";

// Text — synchronous
const text = renderText({
  template: "# {{title}}\n\nRent: {{monthlyRent}}",
  data: { title: "Lease", monthlyRent: { amount: 1500, currency: "USD" } },
  form: leaseForm, // enables automatic field type detection
});

// PDF — async, requires template binary
const pdf = await renderPdf({
  template: new Uint8Array(fs.readFileSync("template.pdf")),
  form,
  data,
  bindings: { "PDF_MonthlyRent": "monthlyRent" },
});

// DOCX — async
const docx = await renderDocx({
  template: new Uint8Array(fs.readFileSync("template.docx")),
  data,
  form,
});
```

### renderDocx() options

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `template` | `Uint8Array` | Yes | DOCX template binary |
| `data` | `Record<string, unknown>` | Yes | Field data |
| `form` | `Form` | No | Enables automatic field type serialization |
| `serializers` | `SerializerRegistry` | No | Custom serializers |
| `bindings` | `Record<string, string>` | No | Field-to-template name mappings |
| `signatureOptions` | `SignatureRenderOptions` | No | Signature rendering config |
| `options` | `DocxRenderOptions` | No | `cmdDelimiter`, `failFast`, `processLineBreaks` |

## CLI Rendering

```bash
# Render to stdout
para render my-form.json --data payload.json

# Render to file
para render my-form.json --data payload.json --out output.pdf

# Specify layer (renderer auto-detected from MIME type)
para render my-form.json --data payload.json --layer markdown

# Force renderer
para render my-form.json --data payload.json --renderer pdf

# With bindings (path or inline JSON)
para render my-form.json --data payload.json --bindings bindings.json

# JSON summary output
para render my-form.json --data payload.json --format json

# Validate and resolve only
para render my-form.json --data payload.json --dry-run
```

When both `--renderer` and `--bindings` are provided, CLI bindings merge on top of layer-spec bindings (CLI wins).

### Data payload

```bash
para render form.json --data payload.json
para render form.json --data payload.yaml
para render form.json --data '{"fields":{"name":"Alice"}}'
```

### Renderer management

Renderers (`text`, `pdf`, `docx`) auto-install on first use to `~/.paradoc/renderers/`.

```bash
para renderers status
para renderers install
para renderers remove
```

## Automatic Field Serialization

When a `form` schema is provided, renderers detect field types and format values automatically:

- `money` → `$1,500.00`
- `person` → `Jane Smith`
- `address` → `123 Main St, Portland, OR, 97201, USA`
- `phone` → formatted phone number

Without a form schema, values render as-is (raw `.toString()`).

For locale-aware formatting and custom serializers, see [serialization.md](./serialization.md).

## Custom Serializers

```typescript
import { createSerializer } from "@paradoc/serialization";

const euSerializer = createSerializer({ regionFormat: "eu" });

const output = await form.fill(data).render({
  renderer: textRenderer({ serializers: euSerializer }),
  layer: "markdown",
  resolver,
});
```

## Inspecting PDF Fields

### SDK

```typescript
import { inspectAcroFormFields } from "@paradoc/renderer-pdf";

const fields = await inspectAcroFormFields(template);
// => [{ name: "PDF_MonthlyRent", type: "text", ... }, ...]
```

### CLI

```bash
para inspect template.pdf
para inspect template.pdf --format json
para inspect template.pdf --filter "Landlord*"
para inspect template.pdf --summary
para inspect template.pdf --include-buttons --include-signatures
para inspect template.pdf --out fields.json
```

Use `para inspect` to discover PDF AcroForm field names before configuring bindings.

### Hashing files

```bash
para hash template.pdf
para hash template.pdf --json
para hash template.pdf -a sha256
```

Computes a SHA-256 checksum for use in layer `checksum` properties.

## Resolvers

Resolvers load layer files (templates, PDFs, DOCX) at render time. Required when layers use `kind: "file"`. NOT needed for `kind: "inline"`.

### Filesystem resolver (Node.js)

```typescript
import { createFsResolver } from "@paradoc/resolvers";

const resolver = createFsResolver({ root: process.cwd() });
```

### Memory resolver (testing)

```typescript
import { createMemoryResolver } from "@paradoc/core";

const resolver = createMemoryResolver({
  contents: {
    "/templates/form.md": "# {{title}}\n\nRent: {{monthlyRent}}",
    "/templates/form.pdf": pdfBytes,
  },
});
```

ALWAYS use `createMemoryResolver` in tests. NEVER read from the filesystem in unit tests.

## See Also

- [layers.md](./layers.md) — layer definitions, Handlebars syntax, signature helpers
- [serialization.md](./serialization.md) — locale-aware formatters
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings
- [sdk.md](./sdk.md) — `form.fill().render()` pipeline
- [cli.md](./cli.md) — `para render`, `para inspect`, `para hash`
