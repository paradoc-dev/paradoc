---
name: rendering
description: Render calls in the SDK and CLI - form.fill().render(), render options, createLayerRenderer engine options, resolvers, direct engines, PDF utilities, render errors
metadata:
  tags: rendering, render, createLayerRenderer, renderers, resolver, createFsResolver, createMemoryResolver, renderText, renderPdf, renderDocx, paradoc render
---

# Rendering

**Contents:** [Install](#install) · [Render a form](#render-a-form) · [Render options](#render-options) · [createLayerRenderer options](#createlayerrenderer-options) · [Resolvers](#resolvers) · [Direct engines](#direct-engines) · [PDF utilities](#pdf-utilities) · [CLI](#cli) · [Errors](#errors)

This file covers render calls. To declare a layer, load [layers.md](./layers.md); to write a template, [templates.md](./templates.md); to seal a layer for signing, [sealing.md](./sealing.md); to read a filled PDF back, [pdf.md](./pdf.md#read-a-filled-pdf-back).

## Install

```bash
npm install @paradoc/sdk @paradoc/resolvers
```

`@paradoc/sdk` includes the built-in engines and re-exports `createLayerRenderer`. Add `@paradoc/render` only to import its subpaths directly (`@paradoc/render/pdf`, `/text`, `/docx`).

## Render a form

Bind a resolver when you construct the form, fill it, and render a layer. The built-in engines are the default, so the call needs no renderer.

```typescript
import { readFile, writeFile } from "node:fs/promises";
import { p } from "@paradoc/sdk";
import { createFsResolver } from "@paradoc/resolvers/fs";

const schema = JSON.parse(await readFile("lease.json", "utf8"));
const form = p.form(schema, { resolver: createFsResolver({ root: "." }) });

const draft = form.fill({
  fields: { tenantName: "Ada Lovelace", monthlyRent: { amount: 1500, currency: "USD" } },
});

const markdown = await draft.render(); // defaultLayer, or the first layer
const pdf = await draft.render({ layer: "pdf" }); // Uint8Array
await writeFile("lease.pdf", pdf);
```

- Text layers return a `string`. PDF, DOCX and React layers return a `Uint8Array`.
- The resolver root is the artifact file's directory. Layer paths resolve inside it.
- Every instance derived from the form (each `fill`, each `update`) carries the resolver. Bind it the same way with `p.load(content, { resolver })`, `p.document(def, { resolver })`, `p.checklist(def, { resolver })` or a builder's `.build({ resolver })`.
- Inline layers need no resolver.
- A draft renders before every required field is filled. `progressive` sets how missing values print.

Documents render raw layer content by default; forms and checklists render through their engine. See [layers.md](./layers.md#render-by-kind).

## Render options

`render()` on a form instance takes:

| Option | Type | Effect |
|--------|------|--------|
| `layer` | `string` | Layer key. Default: `defaultLayer`, then the first layer |
| `formatter` | `Formatter` | Locale and value styles for this render ([formatting.md](./formatting.md)) |
| `progressive` | `{ missing?, incomplete? }` | Enable progressive placeholders. Defaults (`—` and `…`) apply only when this option is passed |
| `renderers` | `Record<mimeType, renderer>` | Renderers keyed by MIME type, tried before the built-in engines. React layers need one |
| `renderer` | `ParadocRenderer` | Replaces the engine for this call. Use `createLayerRenderer({ ... })` to pass engine options |
| `bindings` | `Record<string, string>` | PDF layers only: PDF field name → Paradoc path, merged over the layer's own `bindings`. Any other layer refuses it |

```typescript
const preview = await form.fill({ fields: { tenantName: "Ada" } }).render({ progressive: { missing: "____" } });
// Rent: ____
```

## createLayerRenderer options

`createLayerRenderer(options)` from `@paradoc/sdk` builds the MIME-selected engine with options the render call does not take directly. Pass it as `renderer`:

```typescript
import { createLayerRenderer } from "@paradoc/sdk";

const html = await draft.render({
  layer: "html",
  renderer: createLayerRenderer({ textSignatureOptions: { cssClass: "signature" } }),
});
```

| Option | Applies to | Effect |
|--------|-----------|--------|
| `formatter`, `progressive` | all | As in [Render options](#render-options) |
| `textSignatureOptions` | text | `format` (`"text"`, `"html"`, `"markdown"`; defaults from the layer's MIME type), `placeholder` and `captured` text per directive (a string or a function of the context), `altText`, `cssClass` |
| `docxSignatureOptions` | DOCX | `placeholder` and `captured` text per directive |
| `pdfFont` | PDF | `{ bytes, source }`: a TrueType font tried before the layer's `font` ([pdf.md](./pdf.md)) |
| `expressions` | text, DOCX | `{ functions, signatures }`: host functions templates can call. A function needs a signature ([logic.md](./logic.md)) |

`placeholder` and `captured` take keys `signature`, `initials`, `signatureDate`, `capacity` and `printedName`. The default output of each directive is in [templates.md](./templates.md#directive-output).

## Resolvers

A resolver reads the bytes of file layers, layer fonts and instruction files. Any object with `read(path): Promise<Uint8Array>` works.

| Resolver | Import | Rules |
|----------|--------|-------|
| Filesystem | `createFsResolver({ root })` from `@paradoc/resolvers/fs` | Reads under `root` only. `../`, backslashes and drive paths fail. A leading `/` is stripped |
| HTTP | `createHttpResolver({ baseUrl, fetch? })` from `@paradoc/resolvers/http` | Same path rules as the filesystem resolver, beneath `baseUrl`. Pass `fetch` to add host, timeout or size limits |
| Memory | `createMemoryResolver({ contents })` from `@paradoc/resolvers/memory` | Keys match the layer's `path` exactly. Browser-safe |

```typescript
import { createMemoryResolver } from "@paradoc/resolvers/memory";

const resolver = createMemoryResolver({
  contents: {
    "templates/lease.md": "# Lease\n\nRent: {{fields.monthlyRent}}", // layer path: "templates/lease.md"
    "templates/lease.pdf": pdfBytes, // layer path: "templates/lease.pdf"
  },
});
```

Write each memory key exactly as the layer's `path`: `"/templates/lease.md"` misses `templates/lease.md` with `Resolver content not found`. Use the memory resolver in unit tests, so they read no files.

## Direct engines

Call an engine directly to render a template you hold outside an artifact. Data is a flat record of field values; pass `form` to format them by type.

```typescript
import { renderText } from "@paradoc/render/text";

const text = renderText({
  template: "# Lease\n\nRent: {{fields.monthlyRent}}",
  data: { monthlyRent: { amount: 1500, currency: "USD" } },
  form: schema,
});
// Rent: $1,500.00
```

| Function | Import | Options besides `template`, `data`, `form`, `formatter` |
|----------|--------|--------------------------------------------------------|
| `renderText` (sync, `string`) | `@paradoc/render/text` | `mimeType` (`text/html` escapes values), `progressive`, `signatureOptions: TextSignatureOptions`, `expressions`, `layer` |
| `renderPdf` (async) | `@paradoc/render/pdf` | `bindings`, `font`, `layerFont`, `format`, `overlays` |
| `renderDocx` (async) | `@paradoc/render/docx` | `signatureOptions: DocxSignatureOptions`, `options: { cmdDelimiter, processLineBreaks }`, `expressions`, `layer` |

`renderPdf({ overlays })` draws text or images at `page`, `x`, `y` (PDF points from the bottom-left corner), for example on a flat PDF with no form fields. A text overlay takes `text` or a `field` path, plus optional `fontSize`, `width`, `height` and `color`.

## PDF utilities

All from `@paradoc/render/pdf`:

| Task | Function |
|------|----------|
| List form fields | `inspectAcroFormFields(pdf)` |
| Page count and sizes | `inspectPdf(pdf)` → `{ pages: [{ width, height }] }` |
| Check that bound values fit their fields | `checkPdfBindingFit({ template, form, bindings })` |
| Read a filled PDF back into data | `extractPdfData(...)`, or `form.extract(pdf)` ([pdf.md](./pdf.md)) |
| Flatten form fields into page content | `flattenPdf(pdf)` |
| Merge PDFs in order | `mergePdfs([a, b])` |
| Keep some pages | `selectPdfPages(pdf, [1, 3])` (1-based) |
| Find text or signing markers | `locate(pdf, queries)` |

## CLI

```bash
paradoc render lease.json --data data.json                   # rendered layer to stdout
paradoc render lease.json --data data.json --layer pdf --out lease.pdf
paradoc render lease.json --data '{"fields":{"tenantName":"Ada"}}'
paradoc render lease.json --dry-run                          # resolve the layer, render nothing
```

| Flag | Behavior |
|------|----------|
| `--data <pathOrJson>` | A payload `{ fields, parties?, annexes? }` from a JSON/YAML file, `-` (stdin) or inline JSON. Forms only: other kinds print a warning and render raw |
| (no `--data`) | Prints the raw layer: the template text, or the PDF bytes unchanged |
| `--layer <key>` | Layer to render. Default: `defaultLayer` |
| `--out <file>` | Write to a file and print a summary. Without it, the content goes to stdout |
| `--format json` | Prints the `--out` summary as JSON. It does not change the rendered content |
| `--bindings <pathOrJson>` | PDF bindings merged over the layer's own |
| `--dry-run` | Validate and resolve the layer only |

The CLI resolves layer files from the artifact's directory. It renders text, PDF and DOCX layers. For React layers use the SDK with `renderers`, or `paradoc check` and `paradoc dev` (the `paradoc-react` skill).

The engines install on first use under `~/.paradoc/renderers/`. Manage them with `paradoc renderers status`, `install [name]`, `remove [name]` and `update`. `name` is `render` (text, PDF, DOCX) or `react`.

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `UnboundResolverError: Layer "x" is file-backed ... but no resolver is bound` | File layer, no resolver | Pass `{ resolver }` where you construct the artifact |
| `Resolver path "../x" resolves outside the configured root` (`ERR_RESOLVER_OUTSIDE_ROOT`) | Path leaves the resolver root | Move the file under the artifact's directory |
| `Resolver content not found: "x"` (`ERR_RESOLVER_NOT_FOUND`) | Memory key differs from the layer path, or the HTTP resolver got a 404 from its fetch | Use the layer's `path` string as the key, or publish the file under the base URL |
| `ERR_RESOLVER_INVALID_OPTIONS` | A resolver was created with a bad `root`, `baseUrl` or `contents` | Pass the options in the table above |
| `Layer "x" not found` | Wrong `layer` or `defaultLayer` | Use a key from `layers` |
| `UnregisteredLayerRendererError` | React layer without a renderer | Pass `renderers` (the `paradoc-react` skill) |
| `Unsupported render layer MIME type: x` | No engine for the MIME type | Use a type from [layers.md](./layers.md#mime-type-and-engine) |
| `TemplateError` | An expression failed at render | Fix the expression at the reported layer, line and column ([templates.md](./templates.md)) |
| `PdfFieldFillError` (`overflow`, `comb-length`, `missing-glyph`, `unsupported-script`) | A value does not fit or cannot be drawn | See [pdf.md](./pdf.md) |
