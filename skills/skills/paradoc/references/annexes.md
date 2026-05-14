---
name: annexes
description: File attachments associated with forms — annex slots, required attachments, additional annexes, fill data
metadata:
  tags: annexes, attachments, files, forms
---

# Annexes

Annexes are file attachments associated with a **form** (photo IDs, proof of income, supporting documents). Like fields, parties, and layers, annexes are first-class form constituents.

Annexes apply to forms only. Documents, bundles, and checklists do NOT have annexes.

## JSON Shape

Annexes are defined as a top-level `annexes` object on a form. Each key is an annex identifier; each value is an annex definition.

```json
{
  "$schema": "https://schema.paradoc.dev/2026-01-01/form.json",
  "name": "lease-application",
  "kind": "form",
  "annexes": {
    "photoId": { "title": "Photo ID", "required": true },
    "proofOfIncome": { "title": "Proof of Income", "required": true },
    "references": { "title": "References" }
  },
  "allowAdditionalAnnexes": true,
  "fields": { /* ... */ }
}
```

## Annex Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Human-readable name |
| `description` | string | Detailed description |
| `required` | CondExpr | Whether this annex is mandatory |
| `visible` | CondExpr | Conditional visibility |
| `order` | number | Display ordering |

## Additional Annexes

Set `allowAdditionalAnnexes: true` on the form to accept attachments beyond the defined slots. Default is `false`.

```json
"allowAdditionalAnnexes": true
```

## SDK Builders

```typescript
import { para } from "@paradoc/core";

// Object pattern (preferred)
const form = para.form({
  name: "lease-application",
  version: "1.0.0",
  annexes: {
    photoId: { title: "Photo ID", required: true },
    proofOfIncome: { title: "Proof of Income", required: true },
    references: { title: "References" },
  },
  allowAdditionalAnnexes: true,
  fields: { /* ... */ },
});

// Builder pattern
const form = para.form()
  .name("lease-application")
  .annexes({
    photoId: para.annex().title("Photo ID").required(true),
    proofOfIncome: para.annex().title("Proof of Income").required(true),
    references: para.annex().title("References"),
  })
  .allowAdditionalAnnexes(true)
  .fields({ /* ... */ })
  .build();
```

### Annex builder methods

| Method | Description |
|--------|-------------|
| `.title(string)` | Human-readable name |
| `.description(string)` | Description |
| `.required(bool)` | Mandatory |
| `.visible(CondExpr)` | Conditional visibility |
| `.order(number)` | Display order |
| `.from(data)` | Create from existing annex data |

## Filling Annex Data

```typescript
const draft = form.fill({
  fields: { /* ... */ },
  annexes: {
    photoId: { filename: "id-front.pdf", contentType: "application/pdf" },
    proofOfIncome: { filename: "paystub.pdf", contentType: "application/pdf" },
  },
});
```

## See Also

- [artifacts.md](./artifacts.md) — form structure
- [fields.md](./fields.md) — field types
- [parties.md](./parties.md) — party roles
- [sdk.md](./sdk.md) — fill lifecycle
