---
name: artifacts
description: The four Paradoc artifact types (form, document, bundle, checklist) — top-level structure, required properties, JSON and SDK shapes
metadata:
  tags: artifacts, form, document, bundle, checklist, structure, top-level
---

# Artifact Types

**Contents:** [Shared base](#shared-base-properties) · [Form](#form) · [Document](#document) · [Bundle](#bundle) · [Checklist](#checklist) · [SDK shapes](#sdk-shapes)

Paradoc has four artifact kinds discriminated by the `kind` property: `form`, `document`, `bundle`, `checklist`.

## Shared Base Properties

All four artifact types share these properties:

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `name` | YES | string | Artifact identifier. Pattern: `^[A-Za-z0-9]([A-Za-z0-9]\|-[A-Za-z0-9])*$` |
| `kind` | YES | enum | `"form"`, `"document"`, `"bundle"`, or `"checklist"` |
| `$schema` | No | string | JSON Schema URI |
| `version` | No | string | Semver: `^[0-9]+\.[0-9]+\.[0-9]+$` |
| `title` | No | string | Human-readable title (max 200 chars) |
| `description` | No | string | Detailed description (max 2000 chars) |
| `code` | No | string | Internal code (max 200 chars) |
| `releaseDate` | No | string | ISO date: `YYYY-MM-DD` |
| `metadata` | No | object | Key-value pairs (string/number/boolean/null) |
| `instructions` | No | ContentRef | Domain/compliance reference content |
| `agentInstructions` | No | ContentRef | LLM/agent prompts for presentation |

Schema URIs (current schema version `2026-01-01`):

| Artifact | `$schema` URI |
|----------|---------------|
| Form | `https://schema.paradoc.dev/2026-01-01/form.json` |
| Document | `https://schema.paradoc.dev/2026-01-01/document.json` |
| Bundle | `https://schema.paradoc.dev/2026-01-01/bundle.json` |
| Checklist | `https://schema.paradoc.dev/2026-01-01/checklist.json` |

## Form

Interactive data collection with fields, parties, signatures, layers, and logic.

**Required:** `name`, `kind`

**Form-specific properties:**

| Property | Type | Description |
|----------|------|-------------|
| `fields` | object | Field definitions keyed by field ID — see [fields.md](./fields.md) |
| `parties` | object | Party role definitions — see [parties.md](./parties.md) |
| `layers` | object | Render layers — see [layers.md](./layers.md) |
| `defaultLayer` | string | Key of the default layer |
| `annexes` | object | Predefined annex slots — see [annexes.md](./annexes.md) |
| `allowAdditionalAnnexes` | boolean | Allow ad-hoc annexes (default: `false`) |
| `defs` | object | Computed values — see [logic.md](./logic.md) |
| `rules` | object | Validation rules — see [logic.md](./logic.md) |

### Minimal form (JSON)

```json
{
  "$schema": "https://schema.paradoc.dev/2026-01-01/form.json",
  "name": "my-form",
  "kind": "form"
}
```

### Realistic form (JSON)

```json
{
  "$schema": "https://schema.paradoc.dev/2026-01-01/form.json",
  "name": "rental-application",
  "kind": "form",
  "version": "1.0.0",
  "title": "Rental Application",
  "fields": {
    "applicantName": { "type": "text", "label": "Full Name", "required": true },
    "monthlyIncome": { "type": "money", "label": "Monthly Income", "required": true }
  },
  "parties": {
    "applicant": {
      "label": "Applicant",
      "partyType": "person",
      "signature": { "required": true }
    }
  }
}
```

## Document

Static content with data placeholders — no fields, no parties.

**Required:** `name`, `kind`

**Document-specific properties:**

| Property | Type | Description |
|----------|------|-------------|
| `layers` | object | Render layers |
| `defaultLayer` | string | Key of the default layer |

### Realistic document (JSON)

```json
{
  "$schema": "https://schema.paradoc.dev/2026-01-01/document.json",
  "name": "privacy-policy",
  "kind": "document",
  "version": "2.1.0",
  "title": "Privacy Policy",
  "layers": {
    "markdown": {
      "kind": "inline",
      "mimeType": "text/markdown",
      "text": "# Privacy Policy\n\nEffective: {{effectiveDate}}"
    }
  },
  "defaultLayer": "markdown"
}
```

When to choose document vs form:

| Use document when... | Use form when... |
|---------------------|-----------------|
| Content is static / read-only | Has fillable fields |
| No parties or signatures | Parties must sign |
| Disclosures, regulations, reference | Agreements, applications, contracts |

## Bundle

Composes multiple artifacts (forms, documents, checklists, other bundles) into an ordered package.

**Required:** `name`, `kind`, `contents`

**Bundle-specific properties:**

| Property | Type | Description |
|----------|------|-------------|
| `contents` | array | Ordered list of content items (REQUIRED, may be empty) |
| `defs` | object | Cross-artifact computed values |

Each content item is one of three types:

```json
{ "type": "inline", "key": "mainForm", "artifact": { "name": "...", "kind": "form" } }
{ "type": "path", "key": "schedule-a", "path": "artifacts/schedule-a.json" }
{ "type": "registry", "key": "w9", "slug": "@irs/tax-forms/w9@1.0.0" }
```

`path` and `registry` items also support optional `include` (CondExpr) for conditional inclusion.

### Realistic bundle (JSON)

```json
{
  "$schema": "https://schema.paradoc.dev/2026-01-01/bundle.json",
  "name": "loan-package",
  "kind": "bundle",
  "version": "1.0.0",
  "contents": [
    { "type": "path", "key": "application", "path": "artifacts/loan-application.json" },
    { "type": "path", "key": "disclosure", "path": "artifacts/truth-in-lending.json", "include": "fields.loanAmount > 10000" },
    { "type": "registry", "key": "w9", "slug": "@irs/tax-forms/w9@1.0.0" }
  ]
}
```

## Checklist

Tracks status of ordered items.

**Required:** `name`, `kind`, `items`

**Checklist-specific properties:**

| Property | Type | Description |
|----------|------|-------------|
| `items` | array | Array of checklist items (REQUIRED, may be empty) |
| `layers` | object | Render layers |
| `defaultLayer` | string | Key of the default layer |

Each item:

| Property | Required | Description |
|----------|----------|-------------|
| `id` | YES | Unique item identifier (max 128 chars) |
| `title` | YES | Item title (max 500 chars) |
| `description` | No | Detailed description (max 2000 chars) |
| `status` | No | `{ "kind": "boolean" }` or `{ "kind": "enum", "options": [...] }` |

### Realistic checklist (JSON)

```json
{
  "$schema": "https://schema.paradoc.dev/2026-01-01/checklist.json",
  "name": "closing-checklist",
  "kind": "checklist",
  "items": [
    { "id": "title-search", "title": "Title Search Complete", "status": { "kind": "boolean", "default": false } },
    {
      "id": "appraisal",
      "title": "Property Appraisal",
      "status": {
        "kind": "enum",
        "options": [
          { "value": "pending", "label": "Pending" },
          { "value": "scheduled", "label": "Scheduled" },
          { "value": "complete", "label": "Complete" }
        ],
        "default": "pending"
      }
    }
  ]
}
```

## SDK shapes

For TypeScript SDK builders (`para.form()`, `para.document()`, `para.bundle()`, `para.checklist()`) and runtime lifecycle (`fill`, `prepareForSigning`, `finalize`, `assemble`), see [sdk.md](./sdk.md).

Quick reference for SDK creation patterns:

```typescript
import { para } from "@paradoc/core";

// Form
const form = para.form({ name: "lease", version: "1.0.0", fields: { /* ... */ } });

// Document
const doc = para.document({ name: "policy", version: "1.0.0", layers: { /* ... */ } });

// Bundle
const bundle = para.bundle({
  name: "package",
  contents: [
    { type: "inline", key: "lease", artifact: form.toJSON({ includeSchema: false }) },
  ],
});

// Checklist
const checklist = para.checklist({
  name: "closing",
  items: [{ id: "task1", title: "First Task", status: { kind: "boolean" } }],
});
```

ALWAYS pass `{ includeSchema: false }` when inlining artifacts in bundles — schema duplication wastes space and breaks validation.

## See Also

- [fields.md](./fields.md) — field definitions for forms
- [parties.md](./parties.md) — party roles and signatures
- [layers.md](./layers.md) — render templates
- [logic.md](./logic.md) — defs, rules, conditional expressions
- [annexes.md](./annexes.md) — file attachments
- [instructions.md](./instructions.md) — ContentRef
- [sdk.md](./sdk.md) — TypeScript SDK lifecycle (fill, sign, render)
- [schemas.md](./schemas.md) — `npx paradoc validate` and shared rules
