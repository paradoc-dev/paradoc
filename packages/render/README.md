# @paradoc/render

Dependency-light text, PDF, and DOCX rendering for Paradoc. It works in modern
browsers and on the server. Use a format-specific entry point so an application
only bundles the implementation it needs.

```ts
import { renderText } from '@paradoc/render/text'
import { renderPdf } from '@paradoc/render/pdf'
import { renderDocx } from '@paradoc/render/docx'
```

The package is additive. The existing `@paradoc/renderer-*` packages remain in
place while consumers verify compatibility.

## Text templates

Text rendering supports interpolation, nested paths, escaping, loops,
conditionals, context changes, and a small set of deterministic helpers.

```handlebars
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

A PDF render can fill AcroForm fields, add coordinate-based text, or do both.
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
  ],
})
```

`inspectAcroFormFields()` discovers fields without modifying a PDF.

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
