---
name: annexes
description: Annexes for file attachments on a form. Annex properties, additional annexes, the Attachment fill value, runtime state, and SDK builders.
metadata:
  tags: annexes, attachments, files, forms
---

# Annexes

**Contents:** [Annex definitions](#annex-definitions) · [Additional annexes](#additional-annexes) · [Annex fill values](#annex-fill-values) · [Runtime state](#runtime-state) · [SDK](#sdk)

An annex is a place on a form where a file is attached: a photo ID, proof of income, a vet record. Only forms have annexes.

## Annex definitions

A form's `annexes` object maps each annex id to its definition. Annex ids are camelCase, like field ids ([schemas.md § Identifier patterns](./schemas.md#identifier-patterns)).

| Property | Type | Constraint |
|----------|------|------------|
| `title` | string | 1-200 characters |
| `description` | string | 1-1000 characters. Say what document to attach. |
| `required` | CondExpr | `true`, `false`, or a boolean expression. Default: not required. |
| `visible` | CondExpr | Same. A hidden annex is never required. |
| `order` | number ≥ 0 | Display order |

```json schema=form
"fields": {
  "hasPets": { "type": "boolean", "label": "Do you have pets?", "default": false }
},
"annexes": {
  "photoId": { "title": "Photo ID", "description": "Passport or driver's license", "required": true, "order": 0 },
  "proofOfIncome": { "title": "Proof of income", "required": true, "order": 1 },
  "petRecords": {
    "title": "Vet records",
    "visible": "fields.hasPets == true",
    "required": "fields.hasPets == true",
    "order": 2
  }
}
```

For `required` and `visible` expressions, load [logic.md](./logic.md).

## Additional annexes

`allowAdditionalAnnexes` (default `false`) lets a payload attach files under ids the form does not declare. With `false`, an undeclared id fails with `Unknown annex "<id>"`. Each additional value must still be an Attachment.

```json schema=form
"annexes": {
  "photoId": { "title": "Photo ID", "required": true }
},
"allowAdditionalAnnexes": true
```

## Annex fill values

Each annex holds one Attachment:

| Key | Type | Constraint |
|-----|------|------------|
| `name` | string | Required. File name, 1-255 characters. |
| `mimeType` | string | Required. 1-100 characters, such as `application/pdf`. |
| `checksum` | string | Optional. `sha256:` followed by 64 lowercase hex characters. |

These are the only keys (`size` fails with `Unknown field(s): size`). The Attachment describes the file; the bytes travel separately.

Attach with `fill()` and change with `update()`. In an `update()` patch, `undefined` leaves an annex as it is, and `null` is rejected.

```typescript
// form: the lease-application form built in the SDK section below
let draft = form.fill({ fields: { hasPets: false } });
draft = draft.update({
  annexes: {
    photoId: { name: "passport.pdf", mimeType: "application/pdf" },
    proofOfIncome: { name: "paystub.pdf", mimeType: "application/pdf" },
  },
});
```

`prepareForSigning()` fails with `Missing required annex: annexes.photoId` for each required, visible annex that is empty. For the rest of the draft lifecycle, load [filling.md](./filling.md).

## Runtime state

| Call | Returns |
|------|---------|
| `draft.getAnnex(id)` | The Attachment, or `undefined` |
| `draft.isAnnexVisible(id)` | `visible`, evaluated against the current data |
| `draft.isAnnexRequired(id)` | `required`, evaluated. `false` when the annex is hidden. |
| `draft.getAnnexState(id)` | `{ annexId, visible, required }` |

Only a React composition reads an attachment, at `annexes.<id>` (the `paradoc-react` skill). In a text, HTML or DOCX template, `{{annexes.photoId}}` fails validation with `Unknown reference`.

## SDK

`p.form({ ... })` takes plain annex objects. The builder chain takes `p.annex()` builders or plain objects.

```typescript
import { p } from "@paradoc/sdk";

const form = p
  .form()
  .name("lease-application")
  .fields({ hasPets: { type: "boolean", default: false } })
  .annexes({
    photoId: p.annex().title("Photo ID").required(),
    petRecords: p.annex().title("Vet records").visible("fields.hasPets == true").required("fields.hasPets == true"),
    references: { title: "References", order: 2 },
  })
  .allowAdditionalAnnexes(true)
  .build();
```

| Method | Sets |
|--------|------|
| `.title(text)` | `title` |
| `.description(text)` | `description` |
| `.required(cond = true)` | `required` |
| `.visible(cond = true)` | `visible` |
| `.order(n)` | `order` |
| `.from(annex)` | Every property of an existing annex |
| `.build()` | Validates and returns the annex |
