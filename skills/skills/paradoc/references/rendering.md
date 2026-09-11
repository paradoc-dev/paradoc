---
name: rendering
description: Rendering artifacts to text, PDF, DOCX — SDK render API, CLI render command, resolvers, bindings, custom serializers
metadata:
  tags: rendering, renderer, text, pdf, docx, markdown, html, resolvers, render
---

# Rendering

**Contents:** [SDK rendering](#sdk-rendering) · [CLI rendering](#cli-rendering) · [Automatic field formatting](#automatic-field-formatting) · [Resolvers](#resolvers) · [PDF inspection](#inspecting-pdf-fields)

Paradoc renders artifacts to text (Markdown / HTML / plain text), PDF, and DOCX. ALWAYS validate before rendering. Forms without data produce empty output — ALWAYS fill / pass `--data`.

## SDK Rendering

### Installation

```bash
npm install @paradoc/render
```

### Pattern 1: form.fill().render() (recommended)

A file-backed layer's bytes come from a resolver, and the resolver is bound
once, when the form is constructed — `p.form(schema, { resolver })` or a
builder's `.build({ resolver })`. Every instance derived from it — every
`fill`, every mutator, every render call — carries that resolver, so render
options never repeat it.

```typescript
import { p } from "@paradoc/sdk";
import { renderLayer } from "@paradoc/render";
import { createFsResolver } from "@paradoc/resolvers/fs";

const resolver = createFsResolver({ root: process.cwd() });
const form = p.form(schema, { resolver });
const renderer = renderLayer();

// Text / Markdown / HTML
const text = await form.fill(data).render({
  renderer,
  layer: "markdown",
});

// PDF (returns Uint8Array)
const pdf = await form.fill(data).render({
  renderer,
  layer: "pdf",
});

// DOCX (returns Uint8Array)
const docx = await form.fill(data).render({
  renderer,
  layer: "docx",
});

import fs from "node:fs";
fs.writeFileSync("output.pdf", pdf);
fs.writeFileSync("output.docx", docx);
```

Render a file-backed layer with no resolver bound and Paradoc throws
`UnboundResolverError`, naming the layer, the path it wanted, and where to
bind one.

### Pattern 2: direct render functions

```typescript
import { renderText } from "@paradoc/render/text";
import { renderPdf } from "@paradoc/render/pdf";
import { renderDocx } from "@paradoc/render/docx";

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
| `form` | `Form` | No | Enables automatic field type formatting |
| `formatter` | `Formatter` | No | Artifact-wide presentation policy |
| `bindings` | `Record<string, string>` | No | Field-to-template name mappings |
| `signatureOptions` | `SignatureRenderOptions` | No | Signature rendering config |
| `options` | `DocxRenderOptions` | No | `cmdDelimiter`, `failFast`, `processLineBreaks` |

## CLI Rendering

```bash
# Render to stdout
paradoc render my-form.json --data payload.json

# Render to file
paradoc render my-form.json --data payload.json --out output.pdf

# Specify layer (format is selected from its MIME type)
paradoc render my-form.json --data payload.json --layer markdown

# With bindings (path or inline JSON)
paradoc render my-form.json --data payload.json --bindings bindings.json

# JSON summary output
paradoc render my-form.json --data payload.json --format json

# Validate and resolve only
paradoc render my-form.json --data payload.json --dry-run
```

CLI bindings merge on top of layer-spec bindings (CLI wins).

### Data payload

```bash
paradoc render form.json --data payload.json
paradoc render form.json --data payload.yaml
paradoc render form.json --data '{"fields":{"name":"Alice"}}'
```

### Renderer management

The unified `@paradoc/render` package auto-installs on first use under
`~/.paradoc/renderers/`.

```bash
paradoc renderers status
paradoc renderers install
paradoc renderers remove
```

## Automatic Field Formatting

When a `form` schema is provided, renderers detect field types and format values automatically:

- `money` → `$1,500.00`
- `person` → `Jane Smith`
- `address` → `123 Main St, Portland, OR, 97201, USA`
- `phone` → formatted phone number

Without a form schema, values render as-is (raw `.toString()`).

For locale-aware presentation policy, see [formatting.md](./formatting.md).

## Custom Formatting

```typescript
import { createFormatter } from "@paradoc/format";

const formatter = createFormatter({ locale: "de-DE" });

const output = await form.fill(data).render({
  renderer: renderLayer({ formatter }),
  layer: "markdown",
});
```

## Inspecting PDF Fields

### SDK

```typescript
import { inspectAcroFormFields } from "@paradoc/render/pdf";

const fields = await inspectAcroFormFields(template);
// => [{ name: "PDF_MonthlyRent", type: "text", ... }, ...]
```

### CLI

```bash
paradoc inspect template.pdf
paradoc inspect template.pdf --format json
paradoc inspect template.pdf --filter "Landlord*"
paradoc inspect template.pdf --summary
paradoc inspect template.pdf --include-buttons --include-signatures
paradoc inspect template.pdf --out fields.json
```

Use `paradoc inspect` to discover PDF AcroForm field names before configuring bindings.

### Hashing files

```bash
paradoc hash template.pdf
paradoc hash template.pdf --json
paradoc hash template.pdf -a sha256
```

Computes a SHA-256 checksum for use in layer `checksum` properties.

## Resolvers

Resolvers load layer files (templates, PDFs, DOCX) at render time. Required when layers use `kind: "file"`. NOT needed for `kind: "inline"`.

Bind a resolver once, where the artifact is constructed —
`p.form(schema, { resolver })`, a builder's `.build({ resolver })`, or
`p.load(content, { resolver })`. Every instance derived from it afterward
carries the same resolver. There is no per-call resolver option anymore.

### Filesystem resolver (Node.js)

```typescript
import { createFsResolver } from "@paradoc/resolvers/fs";

const resolver = createFsResolver({ root: process.cwd() });
```

### Memory resolver (testing)

```typescript
import { createMemoryResolver } from "@paradoc/resolvers/memory";

const resolver = createMemoryResolver({
  contents: {
    "/templates/form.md": "# {{title}}\n\nRent: {{monthlyRent}}",
    "/templates/form.pdf": pdfBytes,
  },
});
```

ALWAYS use `createMemoryResolver` in tests. NEVER read from the filesystem in unit tests.

## See Also

- [layers.md](./layers.md) — layer definitions, Paradoc template syntax, signature helpers
- [formatting.md](./formatting.md) — locale-aware formatters
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings
- [sdk.md](./sdk.md) — `form.fill().render()` pipeline
- [cli.md](./cli.md) — `paradoc render`, `paradoc inspect`, `paradoc hash`
