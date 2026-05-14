---
name: layers
description: Render templates (file and inline) — JSON shape, MIME types, bindings, signature blocks, Handlebars syntax
metadata:
  tags: layers, templates, file, inline, mimeType, bindings, signature-blocks, handlebars, defaultLayer
---

# Layers

**Contents:** [Layer kinds](#layer-kinds) · [MIME types](#common-mime-types) · [Bindings](#bindings) · [Signature blocks](#signature-blocks) · [Default layer](#default-layer) · [Handlebars syntax](#handlebars-template-syntax)

Layers are render templates attached to forms, documents, and checklists. Defined in the `layers` object, keyed by layer ID (pattern `^[a-z][a-zA-Z0-9_]*$`).

Two kinds: **inline** (embed content in JSON) and **file** (external file).

## Layer Kinds

### Inline layers

Embed template content in the artifact JSON.

**Required:** `kind`, `mimeType`, `text`

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `kind` | YES | `"inline"` | Discriminator |
| `mimeType` | YES | string | MIME type |
| `text` | YES | string | Template content (max 1,000,000 chars) |
| `title` | No | string | Title (max 200) |
| `description` | No | string | Description (max 2000) |
| `bindings` | No | object | Field-to-template mapping |
| `bindingsFrom` | No | string | Reuse another layer's bindings |
| `signatureBlocks` | No | object | Positioned signature locations |

```json
"layers": {
  "markdown": {
    "kind": "inline",
    "mimeType": "text/markdown",
    "title": "Markdown Template",
    "text": "# Lease Agreement\n\nTenant: {{tenantName}}\nRent: {{monthlyRent}}"
  }
}
```

### File layers

Reference an external template file.

**Required:** `kind`, `mimeType`, `path`

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `kind` | YES | `"file"` | Discriminator |
| `mimeType` | YES | string | MIME type |
| `path` | YES | string | Path (relative to artifact, max 1000 chars) |
| `title` | No | string | Title |
| `description` | No | string | Description |
| `checksum` | No | string | `sha256:<64-hex>` |
| `bindings` | No | object | Field-to-template mapping |
| `bindingsFrom` | No | string | Reuse another layer's bindings |
| `signatureBlocks` | No | object | Positioned signature locations |

```json
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "templates/lease-agreement.pdf",
    "checksum": "sha256:a1b2c3d4..."
  }
}
```

For workflow contexts (creating artifacts from scratch, converting PDFs): ALWAYS prefer file layers over inline. Inline is acceptable for small embedded snippets but is harder to maintain.

## Common MIME Types

| MIME Type | Use Case | Layer Key Convention |
|-----------|----------|---------------------|
| `text/markdown` | Markdown templates | `markdown` |
| `text/html` | HTML templates | `html` |
| `text/plain` | Plain text templates | `plainText` |
| `application/pdf` | PDF form templates | `pdf` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | DOCX templates | `docx` |

## Bindings

Bindings map form field IDs (keys) to template placeholder names (values). Essential for PDF/DOCX where placeholder names differ from field IDs. Optional for text/markdown/HTML where you can use `{{fieldName}}` directly.

```json
"bindings": {
  "tenantName": "Tenant_Full_Name",
  "monthlyRent": "Monthly_Rent_Amount",
  "startDate": "Lease_Start_Date"
}
```

Use `bindingsFrom` to reuse another layer's bindings:

```json
"layers": {
  "markdown": {
    "kind": "inline",
    "mimeType": "text/markdown",
    "text": "...",
    "bindings": { "tenantName": "tenant_name", "rent": "monthly_rent" }
  },
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "templates/lease.pdf",
    "bindingsFrom": "markdown"
  }
}
```

PDF AcroForm bindings have additional rules — see [pdf-bindings.md](./pdf-bindings.md).

## Signature Blocks

Signature blocks define positioned signature locations within a layer. Keyed by location ID.

**Required per block:** `type`, `page`, `x`, `y`, `width`, `height`

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `"signature"`, `"initials"`, or `"date"` |
| `page` | integer | 1-based page number (min 1) |
| `x` | number | X coord in points from left edge (min 0) |
| `y` | number | Y coord in points from top edge (min 0) |
| `width` | number | Width in points (min 1) |
| `height` | number | Height in points (min 1) |
| `partyRole` | string | Party role this block is bound to |
| `partyIndex` | integer | 0-based index for multi-party roles (default 0) |
| `label` | string | Human-readable label |
| `required` | boolean | Required (default `true`) |

```json
"signatureBlocks": {
  "tenantSig": {
    "type": "signature",
    "page": 3, "x": 72, "y": 600, "width": 200, "height": 50,
    "partyRole": "tenant", "partyIndex": 0,
    "label": "Tenant Signature"
  },
  "tenantDate": {
    "type": "date",
    "page": 3, "x": 350, "y": 600, "width": 150, "height": 30,
    "partyRole": "tenant", "partyIndex": 0,
    "label": "Date Signed"
  }
}
```

For PDF coordinate estimation, see [pdf-bindings.md](./pdf-bindings.md).

## Default Layer

Set `defaultLayer` on the artifact to specify which layer is used when none is requested:

```json
{
  "name": "my-form",
  "kind": "form",
  "defaultLayer": "markdown",
  "layers": {
    "markdown": { /* ... */ },
    "pdf": { /* ... */ }
  }
}
```

The value MUST match a key in `layers`.

## Handlebars Template Syntax

Text-based templates (markdown, HTML, plain text) use Handlebars. When rendering via `form.fill(data).render()`, **field values are spread at the top level** — NOT nested under `fields.*`:

```handlebars
# {{title}}

**Tenant:** {{tenantName}}
**Monthly Rent:** {{monthlyRent}}
**Start Date:** {{leaseStartDate}}
```

NEVER use `{{fields.tenantName}}` or `{{tenantName.value}}` in text templates.

Parties and annexes remain namespaced: `{{parties.landlord}}`, `{{annexes.photoId}}`. Schema metadata: `{{schema.title}}`, `{{schema.name}}`.

### Conditional sections

```handlebars
{{#if hasPets}}
## Pet Information
Number of pets: {{petCount}}
Pet deposit: {{petDeposit}}
{{/if}}
```

### Iteration

```handlebars
Languages: {{#each languages}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
```

### Signature helpers

NEVER use manual underscore lines for signatures. Use the built-in helpers.

| Helper | Renders |
|--------|---------|
| `{{signature "locationId"}}` | Signature placeholder or captured image |
| `{{initials "locationId"}}` | Initials placeholder or captured image |
| `{{signatureDate "locationId"}}` | `[DATE]` or actual capture date |

The `locationId` is a **document-location string** (where in the document, NOT which party). Use the SAME `locationId` for all parties at the same location — party differentiation is automatic from template context.

**Context requirement:** signature helpers MUST be inside a party block — `{{#each parties.<role>}}` (multi-instance) or `{{#with parties.<role>}}` (single-instance).

#### Single-instance party

```handlebars
{{#with parties.tenant}}
Tenant: {{name}}
Signature: {{signature "final-sig"}}
Date: {{signatureDate "final-sig"}}
{{/with}}

{{#with parties.landlord}}
Landlord: {{name}}
Signature: {{signature "final-sig"}}
Date: {{signatureDate "final-sig"}}
{{/with}}
```

#### Multi-instance party

```handlebars
{{#each parties.tenant}}
Tenant: {{name}}
Signature: {{signature "final-sig"}}
Date: {{signatureDate "final-sig"}}
{{/each}}
```

#### Multiple signatories per party

```handlebars
{{#each parties.landlord.signatories}}
{{signer.person.name}}, {{capacity}}
Signature: {{signature "final-sig"}}
Initials: {{initials "page-init"}}
Date: {{signatureDate "final-sig"}}
{{/each}}
```

#### Wrong — never do this

```handlebars
Tenant: _________________________ Date: _________
Landlord: _________________________ Date: _________
```

Always use the helpers inside a party block.

## Common Template Patterns

### Markdown layer

```markdown
# {{title}}

{{#if description}}
{{description}}

{{/if}}
---

## Personal Information

| Field | Value |
|-------|-------|
| Name | {{firstName}} {{lastName}} |
| Date of Birth | {{dateOfBirth}} |

{{#if hasPets}}
## Pet Information

| Field | Value |
|-------|-------|
| Number of Pets | {{petCount}} |
| Pet Deposit | {{petDeposit}} |
{{/if}}

---

## Signatures

{{#with parties.tenant}}
**Tenant:** {{name}}
Signature: {{signature "final-sig"}}
Date: {{signatureDate "final-sig"}}
{{/with}}

{{#with parties.landlord}}
**Landlord:** {{name}}
Signature: {{signature "final-sig"}}
Date: {{signatureDate "final-sig"}}
{{/with}}
```

### HTML layer

```html
<!DOCTYPE html>
<html>
<head><title>{{title}}</title></head>
<body>
  <h1>{{title}}</h1>
  <table>
    <tr><td>Name</td><td>{{firstName}} {{lastName}}</td></tr>
    <tr><td>DOB</td><td>{{dateOfBirth}}</td></tr>
  </table>

  {{#with parties.tenant}}
  <div>
    <p><strong>Tenant:</strong> {{name}}</p>
    <p>Signature: {{signature "final-sig"}}</p>
    <p>Date: {{signatureDate "final-sig"}}</p>
  </div>
  {{/with}}
</body>
</html>
```

### Plain text layer

```text
{{title}}
============================================================

PERSONAL INFORMATION
------------------------------------------------------------
Name:          {{firstName}} {{lastName}}
Date of Birth: {{dateOfBirth}}

{{#with parties.tenant}}
Tenant:    {{name}}
Signature: {{signature "final-sig"}}
Date:      {{signatureDate "final-sig"}}
{{/with}}
```

## Layer Design Checklist

1. Reference every required field in at least one layer
2. Use `{{fieldName}}` syntax (not `{{fields.fieldName}}`)
3. Add conditional sections (`{{#if}}`) for fields with `visible` expressions
4. Use signature helpers inside party loops — NEVER manual underscore lines
5. Set `defaultLayer` on the artifact
6. Include form title and description at the top
7. Group fields into logical sections matching fieldsets

## SDK Builders

```typescript
// Object pattern (preferred)
layers: {
  markdown: { kind: "file", path: "templates/lease.md", mimeType: "text/markdown" },
  pdf: { kind: "file", path: "templates/lease.pdf", mimeType: "application/pdf" },
}

// Builder pattern
.layers({
  markdown: para.layer().file().path("templates/lease.md").mimeType("text/markdown"),
  pdf: para.layer().file().path("templates/lease.pdf").mimeType("application/pdf"),
})

// Builder method chain
para.layer()
  .file()
  .path("templates/form.pdf")
  .mimeType("application/pdf")
  .title("PDF Template")
  .checksum("sha256:abc123...")
  .bindings({ formFieldId: "PDF_Field_Name" })
  .bindingsFrom("otherLayerKey")
```

## See Also

- [rendering.md](./rendering.md) — renderers, output formats, resolvers
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings, coordinate estimation
- [parties.md](./parties.md) — party roles for signature blocks
- [serialization.md](./serialization.md) — value formatting at render time
