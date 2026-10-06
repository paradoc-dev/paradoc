---
name: artifacts
description: The four artifact kinds (form, document, checklist, bundle). Shared base properties, each kind's top-level shape, and the bundle include condition and what it reads.
metadata:
  tags: artifacts, form, document, checklist, bundle, base, identifiers, include, language
---

# Artifacts

**Contents:** [Kinds](#kinds) · [Shared base](#shared-base) · [Form](#form) · [Document](#document) · [Checklist](#checklist) · [Bundle](#bundle)

An **artifact** is the unit of work: one JSON or YAML file (or one SDK instance) with a `kind`. For the runtime calls and phases of each kind, load [sdk.md](./sdk.md).

## Kinds

| `kind` | Use it for | Required keys |
|--------|-----------|---------------|
| `form` | Data collection with fields, parties, signatures and logic | `name`, `kind` |
| `document` | Static content rendered through layers, with no fields or parties | `name`, `kind` |
| `checklist` | Ordered items, each with a boolean or enum status | `name`, `kind`, `items` |
| `bundle` | An ordered package of other artifacts | `name`, `kind`, `contents` |

Choose a form as soon as the content has one input or one signer; otherwise a document.

## Shared base

Every kind accepts these keys.

| Key | Type | Rule |
|-----|------|------|
| `$schema` | string | `https://schema.paradoc.dev/2026-10-02.json` for every kind ([schemas.md § Schema version](./schemas.md#schema-version)) |
| `name` | string | Kebab-case, 1 to 128 characters ([schemas.md § Identifier patterns](./schemas.md#identifier-patterns)) |
| `kind` | enum | `form`, `document`, `checklist`, `bundle` |
| `version` | string | SemVer 2.0.0: `1.2.3`, `1.3.0-beta.1`, `1.0.0+build.5` |
| `title` | string | 1 to 200 characters |
| `description` | string | Up to 2000 characters |
| `code` | string | The form number as printed by its issuer (e.g. `W-9`, `ACORD 25`), or a self-issued form's own number. 1 to 200 characters |
| `language` | string | BCP 47 tag such as `en`, `en-US`, `fr-CA`. Default `en`. |
| `issuer` | string | Organization that issues the form, e.g. `U.S. Internal Revenue Service` |
| `edition` | object | The issuer's edition this artifact encodes ([Editions](#editions)) |
| `metadata` | object | Kebab-case keys (up to 100 characters); values are string (up to 500), number, boolean or `null` |
| `instructions` | ContentRef | Guidance for people ([instructions.md](./instructions.md)) |
| `agentInstructions` | ContentRef | Guidance for AI agents ([instructions.md](./instructions.md)) |

### Editions

Set `edition` when the issuer reissues the artifact in editions. Every edition of one artifact keeps the same `name` and has its own `version` line.

| `edition` key | Type | Rule |
|---------------|------|------|
| `key` | string | Required. Lowercase letters and digits with single hyphens (`2024-03`, `3b`). Used in coordinates; never changes once published |
| `label` | string | Required. The issuer's edition text as printed (`Rev. March 2024`). Display only |
| `date` | string | When the issuer released it: `YYYY`, `YYYY-MM` or `YYYY-MM-DD` |
| `effectiveFrom` | string | Full ISO date the edition takes effect, only when printed on the form |

```json schema=form
{
  "issuer": "U.S. Internal Revenue Service",
  "code": "W-9",
  "edition": { "key": "2024-03", "label": "Rev. March 2024", "date": "2024-03" }
}
```

A coordinate is `@org/repo/name[/edition][@version]`, for example `@paradoc/irs/w-9/2024-03@1.2.0`: org, repo, artifact, edition, version. An omitted edition is the artifact's current edition (also written `current`); an omitted version is the edition's latest version (also written `latest`). `@org/repo/w-9@1.0.0` is version 1.0.0 of the current edition and fails if absent; it never falls back to another edition. An edition key cannot be `current`, `latest`, `editions`, `tags` or `diff`. The registry URL is the same path with the version as its own segment: `/registry/paradoc/irs/w-9/2024-03/1.2.0`.

Bump `version` by SemVer: major for a removed or renamed field, a changed type, or optional becoming required; minor for a new optional field, layer or annex; patch for labels and template fixes. `version` counts only your own changes, never the issuer's edition.

## Form

| Key | Type | Topic |
|-----|------|-------|
| `fields` | object of field definitions | [fields.md](./fields.md) |
| `parties` | object of party roles | [parties.md](./parties.md) |
| `annexes` | object of file attachments | [annexes.md](./annexes.md) |
| `allowAdditionalAnnexes` | boolean, default `false` | [annexes.md](./annexes.md) |
| `defs` | computed values | [logic.md](./logic.md) |
| `rules` | validation rules | [logic.md](./logic.md) |
| `layers` | render layers | [layers.md](./layers.md) |
| `defaultLayer` | layer key; the first declared layer when unset | [layers.md](./layers.md) |

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-10-02.json",
  "name": "rental-application",
  "kind": "form",
  "version": "1.0.0",
  "title": "Rental Application",
  "language": "en-US",
  "fields": {
    "applicantName": { "type": "text", "label": "Full name", "required": true },
    "monthlyIncome": { "type": "money", "label": "Monthly income", "required": true }
  },
  "parties": {
    "applicant": { "label": "Applicant", "partyType": "person", "signature": { "required": true } }
  },
  "layers": {
    "markdown": {
      "kind": "inline",
      "mimeType": "text/markdown",
      "text": "# Rental Application\n\nApplicant: {{fields.applicantName}}\n\nIncome: {{fields.monthlyIncome}}"
    }
  },
  "defaultLayer": "markdown"
}
```

## Document

A document takes `layers` and `defaultLayer` and nothing else beyond the base. Its templates have no fields to read.

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-10-02.json",
  "name": "privacy-policy",
  "kind": "document",
  "version": "2.1.0",
  "title": "Privacy Policy",
  "layers": {
    "markdown": {
      "kind": "inline",
      "mimeType": "text/markdown",
      "text": "# Privacy Policy\n\nEffective 2026-01-01."
    }
  },
  "defaultLayer": "markdown"
}
```

## Checklist

A checklist takes `items` (required, may be empty), `layers` and `defaultLayer`.

| Item key | Required | Rule |
|----------|----------|------|
| `id` | yes | Unique, up to 128 characters |
| `title` | yes | Up to 500 characters |
| `description` | no | Up to 2000 characters |
| `status` | no | `{ "kind": "boolean", "default"? }` or `{ "kind": "enum", "options": [{ "value", "label" }], "default"? }` |

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-10-02.json",
  "name": "closing-checklist",
  "kind": "checklist",
  "items": [
    { "id": "title-search", "title": "Title search complete", "status": { "kind": "boolean", "default": false } },
    {
      "id": "appraisal",
      "title": "Property appraisal",
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

## Bundle

A bundle takes `contents` (required, ordered, may be empty) and `defs`. Each content item has a `key`, a `type`, and an optional `include`.

| `type` | Source key | Points at |
|--------|-----------|-----------|
| `inline` | `artifact` | A full artifact object of any kind, including a nested bundle |
| `path` | `path` | An artifact file, relative to the bundle file's directory |
| `registry` | `slug` | A platform registry address, `@org/repo/name`: org, repo and name, three lowercase segments, with no edition or version. It is not a CLI `@ns/name` reference. Optional `edition` (an edition key; omitted means the registry's current edition) and `version` (exact SemVer; omitted means the latest of that edition) |

### Include conditions

`include` is a boolean expression ([logic.md](./logic.md)) on any item type. The member is in the bundle when it is `true`, out when `false`, and `unresolved` while the data it reads is missing.

A bundle has no fields of its own, so `fields.x` is an unknown reference. An `include` or a bundle def reads members by content key:

| Reference | Value |
|-----------|-------|
| `forms.<key>.fields.<id>` | A field of a form member |
| `forms.<key>.<def>` | A def of a form member, by its bare key |
| `bundles.<key>.forms.<key>.fields.<id>` | A field of a form in a nested bundle |
| `<def>` | A def in the bundle's own `defs` |

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-10-02.json",
  "name": "loan-package",
  "kind": "bundle",
  "version": "1.0.0",
  "defs": {
    "largeLoan": { "type": "boolean", "value": "forms.application.fields.loanAmount > 10000" }
  },
  "contents": [
    {
      "type": "inline",
      "key": "application",
      "artifact": {
        "name": "loan-application",
        "kind": "form",
        "fields": { "loanAmount": { "type": "number", "label": "Loan amount", "required": true } }
      }
    },
    {
      "type": "inline",
      "key": "truth-in-lending",
      "include": "largeLoan",
      "artifact": {
        "name": "truth-in-lending",
        "kind": "document",
        "layers": { "markdown": { "kind": "inline", "mimeType": "text/markdown", "text": "# Truth in Lending" } }
      }
    },
    { "type": "path", "key": "schedule-a", "path": "schedule-a.json" }
  ]
}
```

Inline every member that an `include` or bundle def reads. `validate` resolves references into inline members only; a reference into a `path` or `registry` member fails with `Unknown variable: "forms.<key>..."`.

An inline artifact may keep or drop its own `$schema`.
