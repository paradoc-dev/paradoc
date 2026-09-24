---
name: sealing
description: The one signing lifecycle for forms. Signers and signatories, signature slots, seal and prepareSeal (local PDF, SealAdapter, hostedSealAdapter), capture, finalize, signatureMap and canonicalPdfHash, and packets with sealBundle and mergePdfs.
metadata:
  tags: sealing, signing, seal, prepareSeal, SealAdapter, hostedSealAdapter, signatureMap, canonicalPdfHash, capture, finalize, witnesses, packets, sealBundle, mergePdfs
---

# Sealing and signing

**Contents:** [Lifecycle](#lifecycle) · [1. Declare slots](#1-declare-slots) · [2. Bind signers](#2-bind-signers) · [3. Seal](#3-seal) · [4. Capture](#4-capture) · [5. Finalize](#5-finalize) · [Packets](#packets) · [Hosted sealing](#hosted-sealing)

Sealing turns a filled draft into the document a signer signs: one flattened, canonical PDF, its SHA-256 hash (`canonicalPdfHash`), and a `signatureMap` that says where each signer signs. Placement and hashing always run in your process, so the result is verifiable. A signing ceremony (your e-sign provider, or your own UI) then captures signatures against that map.

## Lifecycle

```text
draft ── addSigner ── addSignatory ──┬── seal()             ──► signable (sealed: canonical PDF + signatureMap)
                                     └── prepareForSigning() ──► signable (unsealed: no PDF, no map)
signable ── capture* ── finalize() ──► executed
```

| Phase | Get there with | Changes allowed |
|-------|----------------|-----------------|
| `draft` | `form.fill(data)` | `update()`, parties, annexes, `addSigner`, `removeSigner`, `addSignatory`, `setTargetLayer` |
| `signable` | `draft.seal(options)` or `draft.prepareForSigning()` | Data is frozen. `capture*`, `addWitness`, `addAttestation` |
| `executed` | `signable.finalize()` | None. Read-only record with `executedAt` |

To store a form in any phase and load it back, see [filling.md § Persist and resume](./filling.md#persist-and-resume).

Import everything from `@paradoc/sdk` (it re-exports `@paradoc/core`). `hostedSealAdapter` exists only in `@paradoc/sdk`. `mergePdfs` comes from `@paradoc/render/pdf`.

## 1. Declare slots

A layer declares where each party signs in its `signatures` map. Write the slots by [layers.md § Signature slots](./layers.md#signature-slots), and place `flow` slots in a text template with the [signing directives](./templates.md#signing-directives).

This scratch form has a PDF layer with absolute slots and a markdown layer with a `flow` slot. It is used through the rest of this file.

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-09-24.json",
  "kind": "form",
  "name": "pet-addendum",
  "version": "1.0.0",
  "title": "Pet Addendum",
  "fields": {
    "petName": { "type": "text", "label": "Pet name", "required": true, "maxLength": 20 },
    "weight": { "type": "number", "label": "Weight in pounds", "required": true, "min": 0, "max": 100 }
  },
  "parties": {
    "tenant": { "label": "Tenant", "partyType": "person", "signature": { "required": true } }
  },
  "defaultLayer": "pdf",
  "layers": {
    "pdf": {
      "kind": "file",
      "mimeType": "application/pdf",
      "path": "pet-addendum.pdf",
      "bindings": { "name": "petName", "weight": "weight" },
      "signatures": {
        "tenant-sig": {
          "party": { "role": "tenant" },
          "type": "signature",
          "placement": { "page": 1, "x": 72, "y": 300, "width": 200, "height": 30 }
        },
        "tenant-date": {
          "party": { "role": "tenant" },
          "type": "date_signed",
          "placement": { "page": 1, "x": 300, "y": 300, "width": 100, "height": 30 }
        }
      }
    },
    "summary": {
      "kind": "inline",
      "mimeType": "text/markdown",
      "text": "# Pet Addendum\n\nPet: {{fields.petName}}\n\nTenant signature: {{signature(parties.tenant, \"tenant-flow-sig\")}}",
      "signatures": {
        "tenant-flow-sig": { "party": { "role": "tenant" }, "type": "signature", "placement": "flow" }
      }
    }
  }
}
```

## 2. Bind signers

A **signer** is a person who signs. A **signatory** binds a signer to one filled party. Sealing and capture both read the binding. A person party with no signatories signs for itself: its signer id is its party id, and it needs no `addSigner`. An organization with no signatories has no signer.

```typescript
import { readFile } from 'node:fs/promises'
import { p } from '@paradoc/sdk'
import { createFsResolver } from '@paradoc/resolvers/fs'

const schema = JSON.parse(await readFile('pet-addendum.json', 'utf8'))
const form = p.form(schema, { resolver: createFsResolver({ root: process.cwd() }) })

let draft = form.fill({
  fields: { petName: 'Rex', weight: 30 },
  parties: { tenant: { name: 'Jane Smith' } }, // id defaults to "tenant-0"
})
draft = draft
  .addSigner('jane', { person: { name: 'Jane Smith' } })
  .addSignatory('tenant', 'tenant-0', { signerId: 'jane' })
```

| Call | Shape | Notes |
|------|-------|-------|
| `addSigner(signerId, signer)` | `{ person: Person, adopted?: { signature?, initials? } }` | `adopted.*` is `{ image?, method: 'drawn' \| 'typed' \| 'uploaded' \| 'certificate' }`. A capture without its own image uses the adopted one. |
| `addSignatory(role, partyId, signatory)` | `{ signerId, capacity? }` | `capacity` is the title the signer signs as ("Managing Member"). One signer can sign for several parties. |
| `removeSigner(signerId)` | | Draft only. |

The resolver reads file layers (the PDF template). Bind it once, where the form is constructed. `seal()` takes no resolver. Forms from `@paradoc/essentials` carry their own resolver, so `w9.fill(data).addSigner(...).addSignatory(...).seal()` works as is.

## 3. Seal

| Goal | Call |
|------|------|
| Seal a PDF layer | `await draft.seal()` (local, no adapter) |
| Seal a markdown, HTML or DOCX layer | `await draft.setTargetLayer('summary').seal({ adapter })` |
| Seal a React (`text/tsx`) layer | `await draft.seal({ renderers })`: see the `paradoc-react` skill |
| Get the signature map without sealing | `await draft.prepareSeal(options)` (stays a draft) |
| Sign without a canonical PDF | `draft.prepareForSigning()` (no `signatureMap`, no hash) |

`seal()` targets the draft's target layer: the artifact's `defaultLayer` unless `setTargetLayer(key)` changed it.

### PDF layer

```typescript
const signable = await draft.seal()

signable.phase             // 'signable'
signable.canonicalPdfBytes // Uint8Array: the flattened PDF the signer sees
signable.canonicalPdfHash  // 'sha256:59f0…'
signable.signatureMap      // [{ id: 'tenant-sig', signerId: 'jane', type: 'signature', page: 1, x: 72, y: 300, width: 200, height: 30, … }, …]
```

`signatureMap` entries are `SigningField` values: `id` (the slot id), `signerId`, `signerIndex`, `type`, `page` (1-based), `x`, `y` (points from the top-left), `width`, `height`, and optional `required` and `label`.

### Markdown, HTML or DOCX layer: `SealAdapter`

A non-PDF layer needs a converter that turns the rendered document into PDF bytes. Core does the placement itself, so a pure byte converter is enough.

```typescript
import type { SealAdapter } from '@paradoc/sdk'

const adapter: SealAdapter = {
  async convert({ document }) {
    // document.content: string | Uint8Array, document.mimeType: 'text/markdown' | …
    return { pdf: await myHtmlToPdf(document.content) }
  },
}

const signable = await draft.setTargetLayer('summary').seal({ adapter })
```

Or use Paradoc's hosted converter. It calls `POST https://api.paradoc.dev/v1/exec/convert` with your API key and is billed per page:

```typescript
import { hostedSealAdapter, HostedConversionError } from '@paradoc/sdk'

const signable = await draft.setTargetLayer('summary').seal({
  adapter: hostedSealAdapter({
    apiKey: process.env.PARADOC_API_KEY!,
    timeoutMs: 30_000, // per request
  }),
})
// A failed conversion throws HostedConversionError with .status and .bodyExcerpt.
```

For `flow` slots, core renders twice: a pass with invisible markers that it locates in the converted PDF, then a clean pass that becomes the canonical document. If the markers move a line wrap between the passes, the seal fails instead of placing a field in the wrong spot.

| `SealOptions` | Use |
|---------------|-----|
| `adapter` | Converter for a non-PDF layer. |
| `renderers` | Renderer registry keyed by MIME type. A React layer renders through it and needs no adapter. |
| `renderer` | Custom renderer for the sealed layer. Not allowed with `flow` slots. |
| `locate` | Custom `SealLocator` for anchor placements. The built-in locator is the default. |
| `formatter` | Value formatting for every seal render pass. See [formatting.md](./formatting.md). |

### Inspect placements first

`prepareSeal()` resolves the signature map and returns the unflattened PDF it describes. The form stays a draft. Use it when an envelope flow needs coordinates before you commit.

```typescript
const prep = await draft.prepareSeal()
prep.signatureMap // same fields seal() produces
prep.provenance   // { 'tenant-sig': 'declared', … }: 'declared' | 'anchor' | 'marker'
prep.warnings     // for example, slots skipped because a party index is unfilled
prep.pdf          // the converted PDF, before flattening
```

### Seal errors

`seal()` and `prepareSeal()` throw `SealConfigError` before anything renders. `error.problems` lists every problem.

| Message contains | Fix |
|------------------|-----|
| `required slots without signatories: slot "tenant-sig" (tenant[0]) has no signatory` | The party is an organization with no signatory. `addSignatory(role, partyId, { signerId })` for that party. |
| `party role "tenant" requires a signature but no slot places it on this layer` | Add a slot for the role on the layer you seal, or seal another layer. |
| `slot "x" references unknown party role "y"` | Fix `party.role` in the slot. |
| `Cannot seal text/markdown without a converter` | Pass `adapter`, or seal a PDF layer. |
| `'flow' placement needs a text-template layer` | Use absolute or anchor placement on PDF layers. |
| `flow supports signature and initials` | Give `date_signed`, `capacity` and `printed_name` slots absolute or anchor placement. |
| `'flow' placement is incompatible with a custom renderer override` | Drop `renderer`, or change the slot's placement. |
| `declares no signature slots` | `prepareSeal()` needs a layer with `signatures`. Add slots, or call `seal()`. |
| `form has no parties` / `no party has a required signature` | A layer with no slots seals only for a party whose signature is required and that has a signer: a person, or an organization with a signatory. |

A slot for an unfilled party index (for example `tenant` index 2 when one tenant is filled) is skipped with a warning, not an error.

## 4. Capture

Captures record a signature against a slot. On a sealed form the location is a `signatureMap` id. Sign-date fields (`date_signed`) are stamped at signing and take no capture.

```typescript
let signed = signable.captureSignature('tenant', 'tenant-0', 'jane', 'tenant-sig', {
  image: 'data:image/png;base64,iVBORw0KGgo…',
  method: 'drawn',
})
```

| Method | Slot type | Extra argument |
|--------|-----------|----------------|
| `captureSignature(role, partyId, signerId, locationId, options?)` | `signature` | `options.image`, `options.method`, `options.timestamp` |
| `captureInitials(role, partyId, signerId, locationId, options?)` | `initials` | as above |
| `captureCapacity(role, partyId, signerId, locationId, text, options?)` | `capacity` | `text`: the title |
| `capturePrintedName(role, partyId, signerId, locationId, text, options?)` | `printed_name` | `text`: the name |

Each capture checks its slot and throws with the value it rejects:

| Error | Cause |
|-------|-------|
| `Signer with ID "jane" not found in registry` | No `addSigner` for that id. A person party with no signatories captures with its party id as `signerId`. |
| `signer "jane" is not a signatory for party "tenant-0" in role "tenant"` | No `addSignatory` binding. |
| `location "x" not found in signatureMap` | Sealed form: the location is not a slot id. |
| `location "tenant-sig" already has a signature capture for signer "jane"` | A slot takes one capture. To redo it, capture on the form instance from before the first capture. |

Read progress with `getSignatureStatus(role)`, `getOverallSignatureStatus()`, `getCapturesForParty(role, partyId)` and `getCapturesForLocation(locationId)`.

### Witnesses and attestations

Add them in the signable phase. A witness is always a person.

```typescript
signed = signed
  .addWitness({ id: 'witness-0', party: { name: 'Sam Witness' }, notary: false })
  .addAttestation({
    witnessId: 'witness-0',
    signature: { image: 'data:image/png;base64,…', method: 'drawn', timestamp: new Date().toISOString() },
    attestsTo: [{ role: 'tenant', partyId: 'tenant-0', signerId: 'jane' }],
  })
```

The number of witnesses a party needs is `parties.<role>.signature.witnesses` in the artifact. See [parties.md](./parties.md).

## 5. Finalize

```typescript
const executed = signed.finalize()
executed.phase      // 'executed'
executed.executedAt // ISO timestamp
```

On a sealed form, `finalize()` throws until every `signatureMap` slot that is not `required: false` has a capture: `Cannot finalize: required signing slots have no capture: "tenant-sig" (signature, signer "jane")`. On an unsealed form (`prepareForSigning()`), `finalize()` checks no captures. Check `getOverallSignatureStatus().complete` yourself before you finalize.

## Packets

A packet is a bundle that a signer receives and signs as one document. `sealBundle()` seals each part that has slots, renders the others, flattens and merges them in bundle order, and returns one PDF with one signature map on packet pages. For the bundle shape, see [artifacts.md](./artifacts.md).

```typescript
import { readFile } from 'node:fs/promises'
import { p, sealBundle, BundleSealError } from '@paradoc/sdk'
import { w9 } from '@paradoc/essentials'

// `form` and the `draft` bound to signer "jane" come from steps 1 and 2.
const w9Draft = w9
  .fill({
    fields: {
      taxClassification: 'individual_or_sole_proprietor',
      ssn: '123-45-6789',
      mailingAddress: { line1: '1 Main St', locality: 'Springfield', region: 'IL', postalCode: '62701', country: 'US' },
    },
    parties: { taxpayer: { name: 'Jane Smith', firstName: 'Jane', lastName: 'Smith' } },
  })
  .addSigner('jane', { person: { name: 'Jane Smith' } })
  .addSignatory('taxpayer', 'taxpayer-0', { signerId: 'jane' })

const bundle = p.bundle({
  $schema: 'https://schema.paradoc.dev/2026-09-24.json',
  name: 'move-in-packet',
  version: '1.0.0',
  title: 'Move-in Packet',
  contents: [
    { type: 'inline', key: 'addendum', artifact: form.toJSON() },
    { type: 'inline', key: 'w9', artifact: w9.toJSON() },
    {
      type: 'inline',
      key: 'id',
      artifact: {
        kind: 'document', name: 'photo-id', version: '1.0.0', title: 'Photo ID', defaultLayer: 'pdf',
        layers: { pdf: { kind: 'file', mimeType: 'application/pdf', path: 'photo-id.pdf' } },
      },
    },
  ],
})

const packet = await sealBundle(bundle, {
  contents: {
    addendum: draft,
    w9: w9Draft,
    id: { kind: 'bytes', content: new Uint8Array(await readFile('photo-id.pdf')), mimeType: 'application/pdf', filename: 'photo-id.pdf' },
  },
  signers: { 'addendum/jane': 'jane', 'w9/jane': 'jane' },
})
```

| `BundleSealOptions` | Use |
|---------------------|-----|
| `contents` | One entry per bundle content key: a filled draft, or `{ kind: 'bytes', content, mimeType, filename? }` for supplied files. The packet reads no paths from the bundle. |
| `signers` | Which part signers are one person: `'<part>/<signerId>'` → packet signer id. Without an entry, each part signer is a separate packet signer. A key that names no part signer is an error. |
| `context` | `{ asOf }`: the clock include conditions read for `today()` and `now()`. Defaults to the current instant. |
| `renderers`, `adapter`, `locate` | As in `SealOptions`, for every part. No resolver: each draft carries its own. |

| Result | Meaning |
|--------|---------|
| `pdf` | The merged, flattened packet. |
| `canonicalPdfHash` | Hash of `pdf`. A signing ceremony binds to this one. |
| `packetHash` | Hash over the merged PDF and every part, including parts carried as attachments. It is the packet's record, not what a signer signs. |
| `signers` | `[{ id: 'jane', index: 0, parts: ['addendum/jane', 'w9/jane'] }]` |
| `signatureMap` | Slot ids prefixed with the part key (`w9/sb1`), `page` on packet pages. Each entry also has `part`, `slot`, `partPage`, `partSignerId`. |
| `parts` | Per part: `kind` (`sealed`, `rendered`, `annex`), `firstPage`, `pageCount`, `digest`, `attached`. |
| `warnings` | Everything reported without failing. |

`sealBundle()` throws `BundleSealError` when the packet cannot be built. `error.problems` lists each issue (for example `bundle content "w9" has no entry`), and `error.part` names the content key when one part failed. A part whose renderer does not produce PDF throws `SealConfigError`. An unreadable part PDF throws `PdfMergeError`, and an encrypted one throws `PdfEncryptedError`.

To merge PDFs with no signing, use `mergePdfs`. Flatten filled AcroForms first: a merge drops interactive form fields.

```typescript
import { mergePdfs } from '@paradoc/render/pdf'

const merged = await mergePdfs([firstPdfBytes, secondPdfBytes]) // Uint8Array
```

## Hosted sealing

Without the SDK, seal through the platform: the MCP `seal` tool ([mcp.md](./mcp.md)) or `POST /v1/exec/seal`. Both fill the artifact and return the canonical PDF, the signature map and the hash. They create no envelope. `data` holds only `fields`, `parties` and `annexes`; pass `signers` (`{ "signer-1": { "person": { "name": "Ada" } } }`) and `signatories` (`{ "<role>": { "<role>-0": [{ "signer_id": "signer-1" }] } }`) beside it so each slot maps to a signer. The MCP `create_envelope` tool seals and sends signing invitations in one call.
