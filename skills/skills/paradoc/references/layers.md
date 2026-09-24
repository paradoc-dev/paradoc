---
name: layers
description: Layer shape (inline and file), MIME type to render engine, React layers, PDF bindings, signature slots, and defaultLayer
metadata:
  tags: layers, layer, mimeType, file, inline, react, tsx, bindings, bindingsFrom, signatures, slots, defaultLayer, checksum
---

# Layers

**Contents:** [Layer shape](#layer-shape) · [MIME type and engine](#mime-type-and-engine) · [React layers](#react-layers) · [Bindings](#bindings) · [Signature slots](#signature-slots) · [Default layer](#default-layer) · [Render by kind](#render-by-kind) · [SDK builders](#sdk-builders)

A layer is one rendering of an artifact: a Markdown page, a filled PDF, a Word file, or a React composition. Forms, documents and checklists declare layers in `layers`, keyed by a layer key (`^[a-z][a-zA-Z0-9_]*$`, such as `markdown`, `pdf`, `pdfCopyB`).

To write what goes inside a text or DOCX layer (markers, loops, signing directives), load [templates.md](./templates.md). To render a layer from code or the CLI, load [rendering.md](./rendering.md).

## Layer shape

A layer is `inline` (content in the artifact) or `file` (a path the resolver reads).

| Property | Inline | File | Notes |
|----------|--------|------|-------|
| `kind` | `"inline"` | `"file"` | Discriminator |
| `mimeType` | required | required | Selects the engine. See [MIME type and engine](#mime-type-and-engine) |
| `text` | required | none | Template content, up to 1,000,000 characters |
| `path` | none | required | Relative to the artifact file's directory, and inside it |
| `checksum` | none | optional | `sha256:<64 hex>`. `paradoc fix -y` writes it |
| `title`, `description` | optional | optional | Up to 200 and 2000 characters |
| `bindings`, `bindingsFrom` | PDF only | PDF only | See [Bindings](#bindings) |
| `signatures` | optional | optional | See [Signature slots](#signature-slots) |
| `font`, `format` | none | PDF only | Font for filled values, money display. See [pdf.md](./pdf.md) |

```json schema=form
{
  "fields": {
    "tenantName": { "type": "text", "label": "Tenant name" }
  },
  "layers": {
    "markdown": {
      "kind": "file",
      "mimeType": "text/markdown",
      "path": "templates/lease.md"
    },
    "summary": {
      "kind": "inline",
      "mimeType": "text/plain",
      "text": "Lease for {{fields.tenantName}}"
    }
  }
}
```

Use a file layer for anything longer than a few lines, so the template stays readable and `paradoc validate` checks its checksum. Add one with the CLI, which detects the MIME type and writes the checksum:

```bash
paradoc attach lease.json templates/lease.md --name markdown -y
```

A file `path` (and a PDF layer's font `path`) resolves against the artifact file's directory and must stay inside it. Keep templates and PDFs next to the artifact or in a subfolder such as `templates/`. A path that leaves the directory fails:

```text
✗ Layer "pdf" PDF could not be read from "../w-9.pdf": Resolver path "../w-9.pdf" resolves outside the configured root
```

## MIME type and engine

`mimeType` picks the engine. The comparison ignores case.

| `mimeType` | Engine | Output | Kinds allowed |
|------------|--------|--------|---------------|
| `text/markdown`, `text/html`, `text/plain` | Text template engine | `string` | inline, file |
| `application/pdf` | PDF AcroForm fill | `Uint8Array` | file |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | DOCX template engine | `Uint8Array` | file |
| `text/tsx`, `text/jsx` | React renderer you register | `Uint8Array` (PDF) | file only |

Any other MIME type fails at render with `Unsupported render layer MIME type`.

## React layers

A `text/tsx` or `text/jsx` layer names a React composition module. It is always a file layer: an inline one fails validation with `React layers must be file layers`. Core has no React engine, so a render needs a registered renderer, or it throws `UnregisteredLayerRendererError`:

```json schema=layers
{
  "composition": {
    "kind": "file",
    "mimeType": "text/tsx",
    "path": "compositions/lease.tsx"
  }
}
```

<!-- dep:R4 -->
```typescript
import { reactLayerRenderers } from "@paradoc/react-pdf";

const pdf = await draft.render({ layer: "composition", renderers: reactLayerRenderers() });
```

A React layer takes no `bindings`, `font` or `format`, and needs no resolver. To compose, check or seal one, use the `paradoc-react` skill.

## Bindings

`bindings` belong to PDF layers only. Each key is a PDF field name, copied exactly from `paradoc inspect`. Each value is a Paradoc path. Text, Markdown, HTML and DOCX templates name values directly as `{{fields.x}}`.

<!-- dep:C8 -->
Validation rejects `bindings` or `bindingsFrom` on a layer that is not `application/pdf`.

```json schema=layer
{
  "bindings": {
    "topmostSubform[0].Page1[0].f1_01[0]": "parties.taxpayer.name",
    "topmostSubform[0].Page1[0].f1_02[0]": "businessName"
  }
}
```

`bindingsFrom` reuses a sibling PDF layer's bindings, for example for the copies of one form (`pdfCopyA`, `pdfCopyB`):

```json schema=layers
{
  "pdfCopyA": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "copy-a.pdf",
    "bindings": { "f1_01": "payerName" }
  },
  "pdfCopyB": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "copy-b.pdf",
    "bindingsFrom": "pdfCopyA"
  }
}
```

- A layer with its own `bindings` ignores `bindingsFrom` completely. There is no merge.
- The reuse is one hop: it takes the named layer's own `bindings`, never that layer's `bindingsFrom`.
- The named layer must exist, or `validateLayers()` and the render fail.

To write binding values (`field:option`, `ssn:1`, `a,b,c`, list and party indices) or read a filled PDF back, load [pdf.md](./pdf.md).

## Signature slots

`signatures` declares where each party signs on this layer, keyed by slot id. Seal and capture read these slots; to run them, load [sealing.md](./sealing.md).

| Property | Required | Description |
|----------|----------|-------------|
| `party` | yes | `{ role, index? }`: a declared party role and its 0-based index (default 0) |
| `type` | yes | `signature`, `initials`, `date_signed`, `capacity`, or `printed_name` |
| `placement` | yes | `"flow"`, absolute `{ page, x, y, width, height }`, or anchor `{ anchor: { text, offsetX?, offsetY?, occurrence? }, width, height }` |
| `required` | no | Default `true` |
| `label` | no | Human-readable label, up to 200 characters |

Placement units are points. `page` is 1-based, and `y` counts from the top edge of the page. To convert `paradoc inspect` boxes into slot coordinates, see [pdf.md § Signature slots on a PDF](./pdf.md#signature-slots-on-a-pdf).

### Slot rules

1. **The slot id is the directive's location string.** `{{signature(parties.tenant, "tenant-sig")}}` renders slot `tenant-sig`. Captures are checked against the same id.
2. **One slot is one party and one type.** Give each party its own id (`tenant-sig`, `landlord-sig`). For a role with `max > 1`, declare one slot per index (`tenant-0-sig`, `tenant-1-sig`) and build the location in the loop, as shown in [templates.md](./templates.md#signing-directives).
3. **`flow`** puts the mark where the template's directive renders. It takes `signature` and `initials` only, on text layers (Markdown, HTML, plain text) and React layers. Place PDF and DOCX slots, and every `date_signed`, `capacity` and `printed_name` slot, with absolute or anchor placement.
4. **`party.role`** names a declared party role. A role with `signature.required: true` needs at least one slot on the layer you seal.
5. **Declare slots up to the role's `max`.** The seal skips slots for unfilled indices.

<!-- dep:C7 -->
`validate()` reports an unknown role, a `flow` slot on a PDF layer, and a `flow` slot of another type. The other rules surface as `SealConfigError` when you seal ([sealing.md § Seal errors](./sealing.md#seal-errors)).

A Markdown layer with in-flow signatures and an anchored date:

```json schema=form
{
  "fields": {
    "monthlyRent": { "type": "money", "label": "Monthly rent" }
  },
  "parties": {
    "tenant": { "label": "Tenant", "partyType": "person", "signature": { "required": true } },
    "landlord": { "label": "Landlord", "partyType": "person", "signature": { "required": true } }
  },
  "defaultLayer": "agreement",
  "layers": {
    "agreement": {
      "kind": "inline",
      "mimeType": "text/markdown",
      "text": "# Lease\n\nRent: {{fields.monthlyRent}}\n\nTenant: {{signature(parties.tenant, \"tenant-sig\")}}\n\nTenant date signed:\n\nLandlord: {{signature(parties.landlord, \"landlord-sig\")}}",
      "signatures": {
        "tenant-sig": { "party": { "role": "tenant" }, "type": "signature", "placement": "flow" },
        "tenant-date": {
          "party": { "role": "tenant" },
          "type": "date_signed",
          "placement": { "anchor": { "text": "Tenant date signed:", "offsetX": 130 }, "width": 120, "height": 16 }
        },
        "landlord-sig": { "party": { "role": "landlord" }, "type": "signature", "placement": "flow" }
      }
    }
  }
}
```

A PDF layer places every slot by coordinates or anchor:

```json schema=layer
{
  "signatures": {
    "taxpayer-sig": {
      "party": { "role": "taxpayer" },
      "type": "signature",
      "label": "Signature of U.S. person",
      "placement": { "page": 1, "x": 175, "y": 586, "width": 195, "height": 14 }
    },
    "taxpayer-date": {
      "party": { "role": "taxpayer" },
      "type": "date_signed",
      "placement": { "page": 1, "x": 410, "y": 586, "width": 80, "height": 14 }
    }
  }
}
```

## Default layer

`defaultLayer` names the layer a render uses when the call names none. Without it, the render uses the first key in `layers`.

```json schema=form
{
  "defaultLayer": "markdown",
  "layers": {
    "markdown": { "kind": "file", "mimeType": "text/markdown", "path": "templates/lease.md" },
    "pdf": { "kind": "file", "mimeType": "application/pdf", "path": "templates/lease.pdf" }
  }
}
```

<!-- dep:C7 -->
`validate()` reports a `defaultLayer` that names no layer. The render fails with `Layer "x" not found`.

## Render by kind

| Kind | What a render returns |
|------|-----------------------|
| form | The layer rendered by its engine, with the form's data |
| checklist | The raw layer content. Pass `renderer: renderLayer()` or `renderers` to evaluate `{{items.x}}` |
| document | The raw layer content. A document has no data, so its templates hold no `{{ }}` markers |

## SDK builders

Declare a layer with `signatures` as an object; the chained `p.layer()` builder has no method for them.

```typescript
import { p } from "@paradoc/sdk";

const lease = p
  .form()
  .name("lease")
  .fields({ tenantName: p.field.text().label("Tenant name") })
  .fileLayer("markdown", { mimeType: "text/markdown", path: "templates/lease.md" })
  .layer("pdf", {
    kind: "file",
    mimeType: "application/pdf",
    path: "templates/lease.pdf",
    bindings: { Tenant_Name: "tenantName" },
  })
  .defaultLayer("markdown")
  .build();
```

`.inlineLayer(key, { mimeType, text, signatures? })` adds an inline layer. `.layers({ ... })` takes a record of objects or `p.layer()` chains. A chain reads `p.layer().file().path("templates/lease.pdf").mimeType("application/pdf").bindings({ Tenant_Name: "tenantName" })`, with `.title()`, `.description()`, `.checksum()`, `.font()`, `.format()`, `.signatures()` and `.bindingsFrom()`. `p.layer().inline()` has `.signatures()` too.
