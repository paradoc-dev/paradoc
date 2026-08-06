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

Text rendering supports interpolation, nested paths, escaping, loops,
conditionals, context changes, and a small set of deterministic helpers.

```text
{{#if approved}}
Approved for {{owner.name}}
{{else}}
Pending
{{/if}}

{{#each items}}
- {{name}}
{{/each}}
```

Supported block helpers are `if`, `unless`, `each`, and `with`. Expression
helpers include `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `not`, `and`, `or`,
`contains`, and `default`. Templates do not execute arbitrary JavaScript.

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

## DOCX templates

DOCX rendering supports direct values, commands split across Word runs, custom
delimiters, line breaks, and structural commands:

```text
{{FOR item IN items}}
{{$item.name}}
{{END-FOR item}}

{{IF approved}}
Approved
{{ELSE}}
Pending
{{END-IF}}
```

`ELSE` is a Paradoc extension beyond the legacy DOCX template syntax. DOCX
templates also support the signature helpers `signature`, `initials`,
`signatureDate`, `capacity`, and `printedName`.

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
