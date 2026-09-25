---
name: render-and-seal
description: Bind a composition to its artifact through a React layer, load the artifact in a browser-safe way, render to PDF with reactLayerRenderers or renderPdf, pick an adapter, match the preview's pages, render drafts, and seal a document or a packet.
metadata:
  tags: react-layer, text/tsx, render, renderPdf, reactLayerRenderers, adapter, takumi, chromium, preview, seal, sealBundle, partial
---

# Render and seal a composition

**Contents:** [Install](#install) · [Declare the layer](#declare-the-layer) ·
[Write the composition](#write-the-composition) ·
[Load the artifact](#load-the-artifact) ·
[Render through the layer](#render-through-the-layer) ·
[Render an element](#render-an-element) · [Adapters](#adapters) ·
[Match the preview](#match-the-preview) · [Drafts](#drafts) · [Seal](#seal) ·
[Seal a packet](#seal-a-packet) · [Errors](#errors)

<!-- dep:R4 -->
Every PDF import on this page comes from `@paradoc/react-pdf`. For the other
imports, see [components.md § Imports](./components.md#imports).

## Install

| Task | Packages |
|---|---|
| Compose and preview | `@paradoc/core @paradoc/react react react-dom`, plus the components from `paradoc add` ([cli.md](./cli.md#paradoc-add)) |
| Render and seal (Node) | add `@paradoc/react-pdf` |
| Chromium adapter | add `puppeteer tailwindcss` (optional peers) |
| `PdfPages` in a packet | add `pdfjs-dist` |

```bash
npm install @paradoc/core @paradoc/react @paradoc/react-pdf react react-dom
```

`renderPdf` and `reactLayerRenderers` run in Node only.

## Declare the layer

A composition binds to its artifact through a **file** layer with `mimeType`
`text/tsx` or `text/jsx`. `path` names the module, relative to the artifact
file. An inline layer with a React MIME type fails validation.

```json
{
  "$schema": "https://schema.paradoc.dev/2026-09-24.json",
  "kind": "form",
  "name": "service-agreement",
  "version": "1.0.0",
  "title": "Service Agreement",
  "fields": {
    "service": { "type": "text", "label": "Service", "required": true },
    "fee": { "type": "money", "label": "Fee", "required": true }
  },
  "parties": {
    "client": { "label": "Client", "partyType": "person", "signature": { "required": true } }
  },
  "layers": {
    "composition": {
      "kind": "file",
      "mimeType": "text/tsx",
      "path": "agreement-document.tsx",
      "signatures": {
        "client-signature": { "party": { "role": "client" }, "type": "signature", "placement": "flow" }
      }
    }
  },
  "defaultLayer": "composition"
}
```

The builder form is `.fileLayer('composition', { mimeType: 'text/tsx', path, signatures })`
followed by `.defaultLayer('composition')`.

### Slot limits

The `signatures` map makes the layer a seal target. Each slot's id is its key.

| Placement | Slot types on a React layer | Where the field lands |
|---|---|---|
| `"flow"` | `signature`, `initials` only | Where the composition draws the matching `Signature` block |
| `{ page, x, y, width, height }` | any slot type | Those coordinates, in points from the top-left |
| `{ anchor: { text }, width, height }` | any slot type | At text in the rendered PDF. Match the rendered case: labels print in uppercase |

A flow slot with another type fails the seal: `flow supports signature and initials`.

A flow slot matches the `Signature` block with the same party role, `index`
(the slot's `party.index`, default `0`) and `type` (default `"signature"`).
Draw one `Signature` block per party, index and type.

## Write the composition

The module's **default export** is the component. It receives
`ReactLayerComponentProps`: `artifact` (the `Form`) and `data`
(`DocumentData`: `{ fields; parties; annexes?; defs? }`). A core render supplies evaluated `defs`; direct compositions may omit them and let `ArtifactProvider` evaluate. Root it in `Document`.

```tsx
// agreement-document.tsx
import type { ReactLayerComponentProps } from '@paradoc/react-pdf'
import { Document } from '@/components/paradoc/document'
import { Field } from '@/components/paradoc/field'
import { Signature } from '@/components/paradoc/signature'

export default function AgreementDocument({ artifact, data }: ReactLayerComponentProps) {
  return (
    <Document artifact={artifact} data={data}>
      <Field path="service" />
      <Field path="fee" />
      <Signature party="client" />
    </Document>
  )
}
```

Draw every signature line with `Signature`: it draws the rule and the
invisible marker the seal measures.

## Load the artifact

A layer render passes `artifact` to the composition, so the composition itself
imports no artifact. A preview, a test, or a direct `renderPdf` call supplies
it. Make the JSON or YAML file the source, because `paradoc check` and
`paradoc dev` pair only with those files ([cli.md](./cli.md#discovery)).

Load it in a module that runs in the browser too:

```ts
// agreement.ts
import { loadFromObject } from '@paradoc/core'
import agreementJson from './agreement.json'

export const agreement = loadFromObject<'form'>(agreementJson)
```

`loadFromObject` validates the object and checks `$schema`. Pass
`agreement.toJSON()` where a component wants a `Form` value.

| Where the code runs | Load with |
|---|---|
| Anything a composition or preview imports | `loadFromObject(json)`, or a builder module (`p.form(spec)`) |
| Node-only scripts and tests | `p.load(await readFile(path, 'utf8'))` is also fine |

## Render through the layer

Core renders a React layer only through a renderer you pass. Fill the form,
then render with `reactLayerRenderers`:

```tsx
// render.ts
import { writeFile } from 'node:fs/promises'
import { reactLayerRenderers } from '@paradoc/react-pdf'
import { agreement } from './agreement'
import AgreementDocument from './agreement-document'

const renderers = reactLayerRenderers({
  components: { 'agreement-document.tsx': AgreementDocument },
})

const draft = agreement.fill({
  fields: { service: 'Website redesign', fee: { amount: 4800, currency: 'USD' } },
  parties: { client: { id: 'client-0', name: 'Ada Lovelace' } },
})

const pdf = await draft.render<Uint8Array>({ layer: 'composition', renderers })
await writeFile('agreement.pdf', pdf)
```

`reactLayerRenderers(options)` returns renderers for `text/tsx` and `text/jsx`.
Spread it beside other renderers.

| Option | Purpose |
|---|---|
| `components` | Components keyed by the layer's `path` or its key. Checked first. Use it in bundled apps and for any artifact you do not control |
| `baseDir` | Directory the import route resolves `path` against. See below |
| `exportName` | Export the import route takes. Default `default` |
| `pdf` | `RenderPdfOptions` for every render: `images`, `furniture`, `tokens`, `adapter`, `fonts` |

**Binding order.** The renderer tries `components` (by path, then by key),
then the import route. A layer neither covers fails with `UnboundReactLayerError`.

**The import route runs the module the artifact names.** The path must be
relative and stay inside `baseDir`, symlinks included, and the runtime must
load `.tsx` (for example `tsx`).
<!-- dep:R2 -->
Leave `baseDir` unset to turn the import route off entirely: `process.cwd()`
is never used, and a layer not in `components` fails naming both options.
`paradoc check` passes the declaring artifact file's directory as `baseDir`.
`paradoc dev` loads discovered compositions through Vite instead of this import
route. Bind an untrusted artifact through `components` only,
and never set `baseDir`.

`reactRenderer(options)` returns the single renderer. `bindComponent(layer, options)`
returns a Promise; await it to get the bound component without rendering.

## Render an element

`renderPdf(element, options?)` renders any tree to PDF and returns
`{ bytes, unknownBreaks, unknownRepeats }`.

```tsx
import { writeFile } from 'node:fs/promises'
import { renderPdf } from '@paradoc/react-pdf'
import { agreement } from './agreement'
import AgreementDocument from './agreement-document'

const { bytes } = await renderPdf(
  <AgreementDocument
    artifact={agreement.toJSON()}
    data={{
      fields: { service: 'Website redesign', fee: { amount: 4800, currency: 'USD' } },
      parties: { client: { name: 'Ada Lovelace' } },
    }}
  />,
)
await writeFile('agreement.pdf', bytes)
```

| Option | Type | Purpose |
|---|---|---|
| `adapter` | `"takumi" \| "chromium" \| PdfAdapter` | Engine. Default `"takumi"` |
| `images` | `{ src, data }[]` | Bytes for every image `src` that is not a `data:` URI. No engine fetches images |
| `plan` | `PageBreakPlan` | The preview's page plan. See [Match the preview](#match-the-preview) |
| `furniture` | `PageFurniture` | Header, footer, and stamp on every page |
| `tokens` | `DocumentTokensInput` | A last token layer for this render, such as a tenant accent |
| `partial` | `boolean` | Render a draft. See [Drafts](#drafts) |
| `fonts` | `PdfFontResource[]` | Application font faces to embed |
| `resolveFrom` | `string` | Directory relative font paths and package specifiers resolve from. Default `process.cwd()` |
| `applicationCss` | `string` | Compiled app CSS. Chromium only |
| `formatter`, `progressive` | | Override the value formatter and its progressive policy |
| `signingMarkers` | `boolean` | Embeds the seal marker face. The seal sets it |

`unknownBreaks` and `unknownRepeats` list plan entries whose keep is not in the
tree. Treat a non-empty list as a stale plan and paginate again.

## Adapters

| Adapter | Directions | Use it for |
|---|---|---|
| `takumi` (default) | `ltr` | Every render. WebAssembly, no browser. Honors the [verified vocabulary](./safe-classes.md) |
| `chromium` | `ltr`, `rtl` | Right-to-left documents, application CSS, browser-exact output. Experimental |

```tsx
import { renderPdf } from '@paradoc/react-pdf'
import { closeChromium } from '@paradoc/react-pdf/chromium'

const { bytes } = await renderPdf(element, { adapter: 'chromium' })
await closeChromium()
```

The Chromium adapter needs `puppeteer`, `tailwindcss` and a Chrome
(`PUPPETEER_EXECUTABLE_PATH`, a standard install, or Puppeteer's download). It
holds one browser open until `closeChromium()`.

## Match the preview

The app, not the composition, wraps the composition in `Pages`. It captures the
plan and sends the plan and the **same** furniture object to the render:

```tsx
// preview.tsx (browser)
import { useState } from 'react'
import type { PagePlan } from '@paradoc/react'
import { Pages } from '@/components/paradoc/pages'
import { agreement } from './agreement'
import AgreementDocument from './agreement-document'
import { furniture } from './furniture'
import { sample } from './sample'

export function AgreementPreview() {
  const [plan, setPlan] = useState<PagePlan | null>(null)
  // send `plan` to the server that renders the PDF
  return (
    <Pages furniture={furniture} onPaginate={setPlan}>
      <AgreementDocument artifact={agreement.toJSON()} data={sample} />
    </Pages>
  )
}
```

```tsx
// render-matching.ts (Node)
import { renderPdf, type PageBreakPlan } from '@paradoc/react-pdf'
import { agreement } from './agreement'
import AgreementDocument from './agreement-document'
import { furniture } from './furniture'
import { sample } from './sample'

export async function renderMatching(plan: PageBreakPlan) {
  return renderPdf(
    <AgreementDocument artifact={agreement.toJSON()} data={sample} />,
    { plan, furniture },
  )
}
```

`furniture.tsx` exports one `PageFurniture` object, for example
`{ footer: <PageNumber /> }`. For the slots, see
[components.md § Furniture slots](./components.md#furniture-slots). For how the
plan is built, see [pagination.md](./pagination.md).

## Drafts

A missing value prints the `blank` placeholder. A finished render fails on an
incomplete value, such as money with no currency (`ArtifactFieldFormatError`),
and on an unfilled party the composition draws. **Partial mode** prints the
placeholder for both while the draft is still being filled:

```tsx
const { bytes } = await renderPdf(element, { partial: true })
```

In a browser preview, use `<Document format={{ partial: true }}>` or
`<PartialValuesProvider partial>` around the tree. `paradoc check` always runs
in partial mode, and the seal always renders finished. A value that is wrong,
not unfinished, fails in both modes.

## Seal

Fill the form, bind a signer to each signing party, and seal with the same
`renderers`. The React renderer writes the PDF, so no `SealAdapter` is needed.

```ts
const signable = await draft
  .addSigner('client-signer', { person: { name: 'Ada Lovelace' } })
  .addSignatory('client', 'client-0', { signerId: 'client-signer' })
  .seal({ renderers })

signable.canonicalPdfBytes // the flattened PDF the signer signs
signable.canonicalPdfHash  // 'sha256:...'
signable.signatureMap      // [{ id: 'client-signature', page: 1, x, y, width, height, ... }]
```

`addSignatory`'s second argument is the party id from the fill payload. A
signer's `person` is always a person: for an organization party, take the
person from a contact field. The seal renders twice. The first pass hands each
`Signature` block an invisible marker and locates it. The second pass is the
clean PDF that is hashed. The signing lifecycle after the seal (capture,
finalize) is in the `paradoc` skill.

## Seal a packet

`sealBundle` seals every form part, merges all parts in bundle order, and
returns one PDF with one signature map. One `renderers` registry serves every
part.

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { p, sealBundle } from '@paradoc/core'
import { reactLayerRenderers } from '@paradoc/react-pdf'
import { agreement } from './agreement'
import AgreementDocument from './agreement-document'

const onboarding = p.bundle({
  name: 'client-onboarding',
  version: '1.0.0',
  title: 'Client Onboarding',
  contents: [
    { type: 'inline', key: 'agreement', artifact: agreement.toJSON() },
    {
      type: 'inline',
      key: 'insurance',
      artifact: {
        kind: 'document', name: 'certificate-of-insurance', version: '1.0.0',
        title: 'Certificate of Insurance', defaultLayer: 'pdf',
        layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'certificate-of-insurance.pdf' } },
      },
    },
  ],
})

const agreementDraft = agreement
  .fill({
    fields: { service: 'Website redesign', fee: { amount: 4800, currency: 'USD' } },
    parties: { client: { id: 'client-0', name: 'Ada Lovelace' } },
  })
  .addSigner('client-signer', { person: { name: 'Ada Lovelace' } })
  .addSignatory('client', 'client-0', { signerId: 'client-signer' })

const packet = await sealBundle(onboarding, {
  renderers: reactLayerRenderers({ components: { 'agreement-document.tsx': AgreementDocument } }),
  contents: {
    agreement: agreementDraft,
    insurance: {
      kind: 'bytes',
      content: new Uint8Array(await readFile('certificate-of-insurance.pdf')),
      mimeType: 'application/pdf',
    },
  },
})
await writeFile('client-onboarding.pdf', packet.pdf)
```

Slot ids in `packet.signatureMap` carry the part key (`agreement/client-signature`)
and `page` is a packet page. When two parts share a signer, map them with
`signers: { 'agreement/client-signer': 'client', 'sow/client-signer': 'client' }`.

## Errors

| Error | Cause and fix |
|---|---|
| `UnregisteredLayerRendererError` | No renderer for `text/tsx`. Pass `renderers: reactLayerRenderers(...)` |
| `UnboundReactLayerError` | Neither `components` nor the import route binds the path. Add the path or key to `components` |
| `UnknownFieldPathError` | A `Field`, `Table` or `Totals` path is not in the artifact. Run `paradoc check` |
| `UnsupportedPdfContentError` | A class outside the verified vocabulary, or an image with no bytes. Every offender is named |
| `ArtifactFieldFormatError` | An incomplete value. Complete it, or render with `partial: true` |
| `UnsupportedDirectionError` | An RTL document on Takumi. Use `adapter: 'chromium'` |
| `MissingAdapterPeerError` | `puppeteer` or `tailwindcss` is missing for Chromium |
| `PageFurnitureOverflowError` | A header or footer is taller than the margin. Raise `marginPx` or shorten the band |
| `SealConfigError` | A required slot has no signatory, or a flow slot is not `signature`/`initials` |
| `MissingSigningMarkerError` | A slot's marker is not in the PDF. The layer declares a flow slot that no `Signature` block draws (check role, index, type), or a custom adapter's fonts do not cover the marker glyphs |
| `AmbiguousSigningMarkError` | Two `Signature` blocks for the same party, index, and type |
| `BundleSealError` | A packet part is missing, mismatched, or fails. `problems` lists each |
