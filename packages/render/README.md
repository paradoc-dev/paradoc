# @paradoc/render

Dependency-light text, PDF, and DOCX rendering for Paradoc. It works in modern
browsers and on the server. Forms use the MIME-selected renderer automatically
and load only the selected layer engine.

```ts
const output = await filled.render({ layer: 'final' })
```

Pass `renderLayer()` explicitly when configuring the built-in renderer or
provide any compatible custom renderer as an override.

```ts
import { renderLayer } from '@paradoc/render'

const output = await filled.render({
  renderer: renderLayer({ serializers }),
  layer: 'final'
})
```

Use a format-specific entry point for inspection, overlays, or other
format-specific operations so an application only bundles that implementation.

```ts
import { renderText } from '@paradoc/render/text'
import { renderPdf } from '@paradoc/render/pdf'
import { renderDocx } from '@paradoc/render/docx'
```

`renderLayer()` supports `text/plain`, `text/markdown`, `text/html`,
`application/pdf`, and DOCX Office MIME types. It fails loudly for an unknown
MIME type rather than guessing.

## Text templates

Text templates keep the block markers `{{#if}}`, `{{#unless}}`, `{{else}}`, and
`{{#each}}`. Everything inside a marker is an artifact expression from
`@paradoc/expr`, the language field logic uses, so a condition means the same in
a template as in a rule. Templates do not execute arbitrary JavaScript.

```text
{{#if fields.approved and fields.total.amount > 1000}}
Approved for {{parties.owner.name}}: {{fields.total}}
{{else}}
Pending
{{/if}}

{{#each fields.items}}
- {{index(item) + 1}}. {{item.name}}{{#unless last(item)}},{{/unless}}
{{/each}}
```

Inside `{{#each}}`, `item` is the row and `parent` the enclosing row. A
condition must be boolean and a loop source a list. `checkTextTemplate()` and
`checkDocxTemplate()` check every expression against a type environment, and a
failed render throws `TemplateError` with the layer, position, and expression.

## PDF forms and overlays

A PDF render can fill AcroForm fields, add coordinate-based text or images, or
combine all three.
Overlay page numbers are one-based and coordinates use PDF points measured from
the bottom-left corner.

```ts
const output = await renderPdf({
  template,
  form,
  data: { name: 'Ada Lovelace' },
  bindings: { legal_name: 'name' },
  overlays: [
    { page: 1, x: 48, y: 72, text: 'Prepared for' },
    { page: 1, x: 48, y: 54, field: 'name', fontSize: 11 },
    {
      page: 1,
      x: 48,
      y: 20,
      width: 120,
      height: 30,
      image: signaturePng,
      mediaType: 'image/png',
      fit: 'contain',
    },
  ],
})
```

`inspectAcroFormFields()` discovers fields without modifying a PDF.
`inspectPdf()` returns its page count and page dimensions. PNG overlays support
non-interlaced 8-bit grayscale, RGB, grayscale-alpha, and RGBA images; JPEG
overlays are also supported.

A filled field follows its own settings: declared font size or auto-size,
alignment, color, comb boxes, and multiline wrapping; a list box shows every
selected value. A value that does not fit shrinks to `MIN_FONT_SIZE` (6 points).
Past that, or with more characters than a comb field has boxes, the render throws
`PdfFieldFillError` with the field name, the `reason` (`overflow` or
`comb-length`), and the `limit`.

Each value, and each overlay text, uses the first font that can draw all of it:
`font` (supplied at render time), then `layerFont` (the font the artifact's PDF
layer declares), then the form's own embedded font for the field, then Helvetica
for Latin-1 text. Fonts are TrueType programs given as `{ bytes, source }`, and
every font used is embedded. A character no font can draw fails with reason
`missing-glyph`; scripts that need shaping, such as Arabic or Devanagari, fail
with `unsupported-script` whatever font is available. A font that cannot be read,
is not TrueType, or forbids embedding fails with `PdfFontError` naming its
`source`.

## Reading filled forms back

`extractPdfData()` reads a filled PDF's AcroForm fields back through a layer's
bindings into artifact data, with a report for each binding target. Combined
bindings are reported as not recoverable rather than split. Most callers use
`form.extract()` from `@paradoc/core`, which also chooses the PDF layer.

```ts
const { data, report } = await extractPdfData({ pdf: filled, form, bindings })
```

## Merging PDFs

`mergePdfs()` concatenates PDFs into one document, keeping every page in the
order given at its own size.

```ts
const packet = await mergePdfs([purchaseOrder, filledW9, certificate])
```

It writes a fresh document rather than an incremental update, because two
sources number their objects from one and an incremental update cannot hold
both. Every object a kept page can reach is copied with a new number and every
reference inside it rewritten; stream bytes are copied exactly as stored, so
nothing is re-encoded. The merge is deterministic: the same sources produce the
same bytes.

**What a merge drops.** Everything the old catalog held rather than the page:

| Dropped | Consequence |
| --- | --- |
| `AcroForm` | Field state is gone. Flatten a filled form with `flattenPdf()` first and its values arrive as page content. |
| `StructTreeRoot` and the role map | The pages are untagged. A copied page keeps its `StructParents` key, which then dangles; readers ignore it, screen readers lose the structure. |
| `Names` and `Dests` | A named destination no longer resolves, so a link that used one goes nowhere. |
| `OCProperties` | A page drawn with optional content loses the configuration deciding which layers are visible, and every layer paints. |
| `Lang` | The document declares no language. |
| `ViewerPreferences`, `PageMode`, `PageLabels` | Presentation hints are gone. |
| `Outlines` and `Metadata` | No bookmarks, no document metadata. |

None of those survive a print either, which is what makes the trade acceptable
for a packet assembled from documents that are already final. A caller who needs
any of them should say so rather than merge.

A single source is returned unchanged. Every failure names its source:
`PdfMergeError` carries the zero-based `source` index for a document with no
catalog, no pages, an encryption dictionary, or bytes the parser cannot read at
all.

## Signature placement

The `@paradoc/render/pdf` subpath locates signature positions in converter-
produced PDFs without a PDF rendering engine. It reads the PDF text layer with
a built-in content-stream scanner, so it runs anywhere the renderer runs.

```ts
import { locate, extractFieldsFromPdf, encode, FieldType } from '@paradoc/render/pdf'

// Find invisible markers injected during rendering, and literal anchor text.
const hits = await locate(pdf, [
  { id: 'client-sig', kind: 'marker', signerIndex: 0, fieldType: FieldType.SIGNATURE },
  { id: 'witness-sig', kind: 'anchor', text: 'Witnessed by:' },
])
// [{ id, page, x, y, width, height }] in PDF points, y from the top edge
```

`locate()` is all-or-nothing: an unresolved or ambiguous query throws a
`LocateError` naming every failed id, so a seal pipeline can never proceed on
a silently incomplete signature map. Anchor text must be unique unless the
query picks an `occurrence`. `extractFieldsFromPdf()` returns every marker in
a document; `pageTextRuns()` exposes positioned text runs for verification and
layout tooling.

## DOCX templates

DOCX rendering supports direct values, commands split across Word runs, custom
delimiters, line breaks, and structural commands:

```text
{{FOR line IN fields.items}}
{{line.name}}
{{END-FOR line}}

{{IF fields.approved}}
Approved
{{ELSE}}
Pending
{{END-IF}}
```

Conditions, loop sources, and placeholders are artifact expressions, as in text
templates. DOCX templates also support the signing directives `signature`,
`initials`, `signatureDate`, `capacity`, and `printedName`, written
`{{signature(parties.client, "client-sign")}}`.

## Benchmarking

From a repository checkout, run `pnpm benchmark` from this package to record
current text, PDF, and DOCX timings. The historical comparison captured before legacy
package retirement lives in `benchmarks/legacy-baseline.json`. The benchmark is
intentionally separate from the unit-test gate, so timing variance does not
make ordinary tests flaky. Set
`PARADOC_BENCHMARK_ITERATIONS` to change the number of measured iterations.
Set `PARADOC_BINARY_BENCHMARK_ITERATIONS` for PDF and DOCX iterations. Use
`pnpm size-report` to verify browser bundles, server imports, and the exact npm
tarball contents and sizes without publishing.
