---
name: layers
description: Render templates (file and inline) — JSON shape, MIME types, bindings, signature blocks, Paradoc template syntax
metadata:
  tags: layers, templates, file, inline, mimeType, bindings, signature-blocks, defaultLayer
---

# Layers

**Contents:** [Layer kinds](#layer-kinds) · [MIME types](#common-mime-types) · [Bindings](#bindings) · [Signature blocks](#signature-blocks) · [Default layer](#default-layer) · [Template syntax](#paradoc-template-syntax)

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
| `anchorBlocks` | No | object | Signature locations found by document text |
| `signatures` | No | object | Unified signature slots (supersede `signatureBlocks`/`anchorBlocks`) |

```json schema=form
"layers": {
  "markdown": {
    "kind": "inline",
    "mimeType": "text/markdown",
    "title": "Markdown Template",
    "text": "# Lease Agreement\n\nTenant: {{fields.tenantName}}\nRent: {{fields.monthlyRent}}"
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
| `font` | No | object | PDF layers only: `{ path, checksum? }` of a TrueType font for filled values. See [pdf-bindings.md](./pdf-bindings.md#fonts) |
| `format` | No | object | PDF layers only: `{ money: { currencyDisplay: "none" } }` when the template pre-prints the currency symbol beside each money box |
| `bindings` | No | object | Field-to-template mapping |
| `bindingsFrom` | No | string | Reuse another layer's bindings |
| `signatureBlocks` | No | object | Positioned signature locations |
| `anchorBlocks` | No | object | Signature locations found by document text |
| `signatures` | No | object | Unified signature slots (supersede `signatureBlocks`/`anchorBlocks`) |

```json schema=form
"layers": {
  "pdf": {
    "kind": "file",
    "mimeType": "application/pdf",
    "path": "templates/lease-agreement.pdf",
    "checksum": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
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

Bindings map template placeholder or PDF field names (keys) to Paradoc data paths (values). Essential for PDF/DOCX where placeholder names differ from field IDs. Optional for text/markdown/HTML where you can use `{{fields.fieldName}}` directly.

```json schema=layer
"bindings": {
  "Tenant_Full_Name": "tenantName",
  "Monthly_Rent_Amount": "monthlyRent",
  "Lease_Start_Date": "startDate"
}
```

Use `bindingsFrom` to reuse another layer's bindings:

```json schema=form
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

## Format

When a PDF template already prints the currency symbol beside each money box (IRS 1099 forms do), declare it on the layer. Every render of that layer then prints the amount alone, such as `12,000.00`, with any formatter; locale and digits stay the formatter's. Other layers of the same artifact keep the symbol.

```json schema=layer
{
  "kind": "file",
  "mimeType": "application/pdf",
  "path": "1099-nec-A.pdf",
  "format": { "money": { "currencyDisplay": "none" } }
}
```

- ONLY PDF layers take `format`. `currencyDisplay: "none"` is the only value.
- The format is the layer's own. A layer that reuses bindings through `bindingsFrom` declares its own `format`.
- ALWAYS declare the money field's `currency`, so reading the PDF back (`form.extract`) knows the currency of an amount printed without a symbol.

## Signature Blocks

Signature blocks define positioned signature locations within a layer. Keyed by location ID.

**Required per block:** `type`, `page`, `x`, `y`, `width`, `height`

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `"signature"`, `"initials"`, `"date"`, `"capacity"` (signer role or title), or `"printed_name"` |
| `page` | integer | 1-based page number (min 1) |
| `x` | number | X coord in points from left edge (min 0) |
| `y` | number | Y coord in points from top edge (min 0) |
| `width` | number | Width in points (min 1) |
| `height` | number | Height in points (min 1) |
| `partyRole` | string | Party role this block is bound to |
| `partyIndex` | integer | 0-based index for multi-party roles (default 0) |
| `label` | string | Human-readable label |
| `required` | boolean | Required (default `true`) |

```json schema=layer
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

### Anchor blocks

`anchorBlocks` takes the same `type`, `width`, `height`, `partyRole`, `partyIndex`, `label`, and `required` as a signature block. In place of `page`/`x`/`y` it has `anchor: { text, offsetX, offsetY }`: the position is found from that text in the rendered document.

### Signature slots

`signatures` is the unified form. It supersedes `signatureBlocks` and `anchorBlocks`, which stay readable during their deprecation window. Keyed by slot ID.

**Required per slot:** `party`, `type`, `placement`

| Property | Type | Description |
|----------|------|-------------|
| `party` | object | `{ role, index? }`: party role and 0-based index (default 0) |
| `type` | string | `"signature"`, `"initials"`, `"date_signed"`, `"capacity"`, or `"printed_name"` |
| `placement` | string or object | `"flow"` (where the template places it), `{ page, x, y, width, height }`, or `{ anchor: { text, offsetX?, offsetY?, occurrence? }, width, height }` |
| `required` | boolean | Required (default `true`) |
| `label` | string | Human-readable label |

A slot's date type is `"date_signed"`. A signature or anchor block's date type is `"date"`. Do not mix them.

```json schema=layer
"signatures": {
  "tenantSig": {
    "party": { "role": "tenant" },
    "type": "signature",
    "placement": { "page": 3, "x": 72, "y": 600, "width": 200, "height": 50 }
  },
  "tenantDate": {
    "party": { "role": "tenant" },
    "type": "date_signed",
    "placement": { "anchor": { "text": "Date:", "offsetX": 40 }, "width": 150, "height": 30 }
  }
}
```

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

## Paradoc Template Syntax

Text-based templates (Markdown, HTML, plain text) and DOCX templates keep their block markers, and EVERYTHING inside a marker is an artifact expression — the same language as `visible`, `required`, defs, and rules (see [logic.md](./logic.md)). Nothing runs arbitrary JavaScript.

Roots are the same as field logic:

- `fields.<id>` — field values (`{{fields.monthlyRent}}`, `{{fields.address.line1}}`)
- a defs key by name — computed values (`{{totalDue}}`)
- `parties.<role>` — typed party values (`{{parties.landlord.name}}`); a role with `max > 1` is a list
- `items.<id>` — checklist item values (`{{items.reviewed}}`); hyphenated ids use brackets: `{{items["signed-contract"]}}`

ALWAYS write `{{fields.tenantName}}`. A bare `{{tenantName}}` is an unknown reference and fails validation. There is no `schema.*` or `annexes.*` root; write the title as text.

```text
# Residential Lease

**Tenant:** {{fields.tenantName}}
**Monthly Rent:** {{fields.monthlyRent}}
**Deposit:** {{fields.monthlyRent.amount * 2}}
**Start Date:** {{fields.leaseStartDate}}
```

A placeholder that is a path prints the value formatted for its type. A computed value is formatted by its result type. In a `text/html` layer, `{{ }}` escapes the value for HTML and `{{{ }}}` prints it without escaping; `text/plain` and `text/markdown` layers print values as written.

### Conditional sections

A condition MUST be boolean. Compare text, numbers, and optional values; NEVER test them bare.

```text
{{#if fields.hasPets}}
## Pet Information
Number of pets: {{fields.petCount}}
{{/if}}

{{#if fields.notes != null}}Notes: {{fields.notes}}{{/if}}
{{#if fields.status == "active" and fields.balance.amount > 0}}...{{else}}...{{/if}}
{{#unless fields.smokingAllowed}}No smoking.{{/unless}}
```

### Iteration

A loop source MUST be a list. Inside `{{#each}}`, `item` is the current row and `parent` the enclosing row. `index(item)`, `first(item)`, and `last(item)` give the position and work only inside a loop.

```text
Languages: {{#each fields.languages}}{{item}}{{#unless last(item)}}, {{/unless}}{{/each}}
{{#each fields.orders}}{{index(item) + 1}}. {{item.name}}: {{#each item.parts}}{{parent.name}}/{{item}} {{/each}}{{/each}}
Total: {{sum(fields.orders.amount)}}
```

### Removed syntax (validation names the replacement)

| Removed | Write |
|---------|-------|
| `(eq a b)`, `ne`, `gt`, `gte`, `lt`, `lte` | `a == b`, `!=`, `>`, `>=`, `<`, `<=` |
| `(and a b)`, `(or a b)`, `(not a)` | `a and b`, `a or b`, `not a` |
| `(contains list x)` | `x in list` |
| `{{default v "x"}}` | `{{coalesce(v, "x")}}` |
| `{{#with X}}` | full paths, `X.member` |
| `this`, `../`, `@root` | `item`, `parent`, a path from the root |
| `@index`, `@first`, `@last` | `index(item)`, `first(item)`, `last(item)` |
| DOCX `===`, `!==`, `{{$row.x}}` | `==`, `!=`, `{{row.x}}` |

### Signature directives

NEVER use manual underscore lines for signatures. Use the signing directives. They place marks, and their arguments are expressions.

| Directive | Renders |
|-----------|---------|
| `{{signature(party, "locationId")}}` | Signature placeholder or captured image |
| `{{initials(party, "locationId")}}` | Initials placeholder or captured image |
| `{{signatureDate(party, "locationId")}}` | `[DATE]` or actual capture date |

The `locationId` is a **document-location string** (where in the document, NOT which party). Use the SAME `locationId` for all parties at the same location — the party argument tells them apart.

**Party:** pass it first — `{{signature(parties.tenant, "final-sig")}}`. Inside `{{#each parties.<role>}}` or `{{#each parties.<role>.signatories}}`, omit it: `{{signature("final-sig")}}` signs for the current row.

#### Single-instance party

```text
Tenant: {{parties.tenant.name}}
Signature: {{signature(parties.tenant, "final-sig")}}
Date: {{signatureDate(parties.tenant, "final-sig")}}

Landlord: {{parties.landlord.name}}
Signature: {{signature(parties.landlord, "final-sig")}}
Date: {{signatureDate(parties.landlord, "final-sig")}}
```

For an optional party, guard the block: `{{#if parties.spouse != null}}...{{/if}}`.

#### Multi-instance party

```text
{{#each parties.tenant}}
Tenant: {{item.name}}
Signature: {{signature("final-sig")}}
Date: {{signatureDate("final-sig")}}
{{/each}}
```

#### Multiple signatories per party

```text
{{#each parties.landlord.signatories}}
{{item.signer.person.name}}, {{item.capacity}}
Signature: {{signature("final-sig")}}
Initials: {{initials("page-init")}}
Date: {{signatureDate("final-sig")}}
{{/each}}
```

#### Wrong — never do this

```text
Tenant: _________________________ Date: _________
Landlord: _________________________ Date: _________
```

Always use the directives.

## Common Template Patterns

### Markdown layer

```markdown
# Residential Lease Application

---

## Personal Information

| Field | Value |
|-------|-------|
| Name | {{fields.firstName}} {{fields.lastName}} |
| Date of Birth | {{fields.dateOfBirth}} |

{{#if fields.hasPets}}
## Pet Information

| Field | Value |
|-------|-------|
| Number of Pets | {{fields.petCount}} |
| Pet Deposit | {{fields.petDeposit}} |
{{/if}}

---

## Signatures

**Tenant:** {{parties.tenant.name}}
Signature: {{signature(parties.tenant, "final-sig")}}
Date: {{signatureDate(parties.tenant, "final-sig")}}

**Landlord:** {{parties.landlord.name}}
Signature: {{signature(parties.landlord, "final-sig")}}
Date: {{signatureDate(parties.landlord, "final-sig")}}
```

### HTML layer

```html
<!DOCTYPE html>
<html>
<head><title>Residential Lease Application</title></head>
<body>
  <h1>Residential Lease Application</h1>
  <table>
    <tr><td>Name</td><td>{{fields.firstName}} {{fields.lastName}}</td></tr>
    <tr><td>DOB</td><td>{{fields.dateOfBirth}}</td></tr>
  </table>

  <div>
    <p><strong>Tenant:</strong> {{parties.tenant.name}}</p>
    <p>Signature: {{{signature(parties.tenant, "final-sig")}}}</p>
    <p>Date: {{{signatureDate(parties.tenant, "final-sig")}}}</p>
  </div>
</body>
</html>
```

In HTML, write signing directives with `{{{ }}}` so their markup is not escaped.

### Plain text layer

```text
RESIDENTIAL LEASE APPLICATION
============================================================

PERSONAL INFORMATION
------------------------------------------------------------
Name:          {{fields.firstName}} {{fields.lastName}}
Date of Birth: {{fields.dateOfBirth}}

Tenant:    {{parties.tenant.name}}
Signature: {{signature(parties.tenant, "final-sig")}}
Date:      {{signatureDate(parties.tenant, "final-sig")}}
```

### DOCX layer

```text
{{IF fields.hasPets}}
Pet deposit: {{fields.petDeposit}}
{{END-IF}}
{{FOR line IN fields.lines}}
{{index(line) + 1}}. {{line.description}} {{line.amount}}
{{END-FOR line}}
```

A DOCX `FOR` names its row; a `FOR` paragraph inside a table row repeats the row.

### Validation

`validate()` (and `paradoc validate`, `validate_artifact`) checks every template expression in inline layers; file-backed text and DOCX layers are checked through a resolver by `validateLayers()`. Errors name the layer, line and column (or DOCX paragraph), and the expression.

## Layer Design Checklist

1. Reference every required field in at least one layer
2. Use `{{fields.fieldName}}` paths, and boolean conditions (`{{#if fields.x != null}}`)
3. Add conditional sections (`{{#if}}`) for fields with `visible` expressions
4. Use signing directives — NEVER manual underscore lines
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
  markdown: p.layer().file().path("templates/lease.md").mimeType("text/markdown"),
  pdf: p.layer().file().path("templates/lease.pdf").mimeType("application/pdf"),
})

// Builder method chain
p.layer()
  .file()
  .path("templates/form.pdf")
  .mimeType("application/pdf")
  .title("PDF Template")
  .checksum("sha256:abc123...")
  .bindings({ formFieldId: "PDF_Field_Name" })
  .bindingsFrom("otherLayerKey")
  .format({ money: { currencyDisplay: "none" } }) // PDF layers only
```

## See Also

- [rendering.md](./rendering.md) — renderers, output formats, resolvers
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings, coordinate estimation
- [parties.md](./parties.md) — party roles for signature blocks
- [formatting.md](./formatting.md) — value formatting at render time
