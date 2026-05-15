---
name: schemas
description: Raw JSON/YAML artifact manipulation surface — schema URIs, top-level structure, validation rules, common errors, npx paradoc validate
metadata:
  tags: schemas, json, yaml, validation, schema-uri, identifiers, naming, errors
---

# Raw JSON/YAML Surface

Use this surface when creating, editing, or validating artifact files (`form`, `document`, `bundle`, `checklist`) directly as JSON or YAML — without TypeScript or the SDK.

For TypeScript SDK usage, see [sdk.md](./sdk.md). For CLI workflow, see [cli.md](./cli.md).

## Schema Version

All artifacts use schema version `2026-01-01`. Set `$schema` to declare the artifact type:

| Artifact | `$schema` URI |
|----------|---------------|
| Form | `https://schema.paradoc.dev/2026-01-01/form.json` |
| Document | `https://schema.paradoc.dev/2026-01-01/document.json` |
| Bundle | `https://schema.paradoc.dev/2026-01-01/bundle.json` |
| Checklist | `https://schema.paradoc.dev/2026-01-01/checklist.json` |

## Validation Command

ALWAYS run validation after every mutation:

```bash
npx paradoc validate <file>
```

Use `npx paradoc` (NOT `para`) when working directly with files — it ensures the CLI is available without a global install.

```bash
# Single file
npx paradoc validate my-form.json

# YAML
npx paradoc validate my-form.yaml

# Multiple files
npx paradoc validate form.json document.json bundle.json
```

For more validation flags (`--silent`, `--json`, `--expect-kind`, `--schema-only`, etc.), see [cli.md](./cli.md#validation).

## Identifier and Naming Patterns

### Artifact name

- Pattern: `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$`
- MUST start with a letter or digit
- May contain letters, digits, single hyphens
- NEVER consecutive hyphens, leading hyphens, or trailing hyphens
- Max 128 chars

| Valid | Invalid |
|-------|---------|
| `my-form`, `W9`, `Form1040`, `rental-application-2024` | `-form`, `my--form`, `form-`, `my_form`, `my form` |

### Version

- Pattern: `^[0-9]+\.[0-9]+\.[0-9]+$`
- Semver `MAJOR.MINOR.PATCH`
- Max 200 chars

| Valid | Invalid |
|-------|---------|
| `1.0.0`, `2.3.1`, `0.1.0` | `v1.0.0`, `1.0`, `1.0.0-beta` |

### Field / layer / def / rule identifiers

- Pattern: `^[a-z][a-zA-Z0-9_]*$`
- MUST start with a lowercase letter
- May contain letters, digits, underscores
- camelCase preferred
- Max 100 chars (50 for party roles)

| Valid | Invalid |
|-------|---------|
| `firstName`, `monthly_rent`, `hasPets` | `FirstName`, `1stField`, `-name`, `first-name` |

### Metadata keys

- Pattern: `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$` (same as artifact name)

## Common Validation Errors

### `name` is required

Every artifact MUST have a `name` property. Add it.

### `kind` is required

Every artifact MUST have a `kind` of `"form"`, `"document"`, `"bundle"`, or `"checklist"`.

### Invalid field identifier

Field keys MUST match `^[a-z][a-zA-Z0-9_]*$`. Common mistakes:

```json
"FirstName"     // wrong: uppercase
"first-name"    // wrong: hyphens
"1stField"      // wrong: starts with digit
```

Fix to camelCase: `firstName`, `firstField`.

### Missing `type` on field

Every non-fieldset field MUST have `type`:

```json
"missingType": { "label": "Some Field" }   // wrong
```

Fix: add `"type": "<fieldType>"`. See [fields.md](./fields.md) for the type list.

### Unknown field type

Common mismatches:

| Wrong | Right |
|-------|-------|
| `"type": "string"` | `"type": "text"` |
| `"type": "number"` | `"type": "integer"` or use `money`/`percentage` |
| `"type": "currency"` | `"type": "money"` |
| `"type": "datetime"` (when only date) | `"type": "date"` |

### Missing `enum` on enum / multiselect

`enum` and `multiselect` MUST have an `enum` array:

```json
"status": { "type": "enum", "label": "Status" }   // wrong
```

Fix: `"enum": [{ "value": "active" }, { "value": "inactive" }]`.

### Missing `contents` on bundle

Bundles MUST have `contents` (array, may be empty):

```json
{ "name": "my-bundle", "kind": "bundle", "contents": [] }
```

### Missing `items` on checklist

Checklists MUST have `items` (array, may be empty).

### Missing `label` on party

Every party role MUST have `label`.

### Invalid `$schema` URI

`$schema` MUST be one of the four URIs above.

### Additional properties not allowed

Schema uses `additionalProperties: false`. Any unknown property errors. Check for typos.

### Invalid checksum format

Checksums MUST match `^sha256:[a-f0-9]{64}$` — `sha256:` prefix + exactly 64 lowercase hex chars.

### Schema valid but artifact behaves unexpectedly

Common causes:

- Expressions in `visible`/`required`/`rules` reference field IDs that don't exist
- Wrong context format (`marital-status` instead of `fields.marital-status` in field-level expressions)

See [logic.md](./logic.md) for expression context rules.

## Workflow

1. Make changes to the artifact JSON / YAML
2. `npx paradoc validate <file>`
3. If errors, fix and repeat
4. NEVER skip validation

## See Also

- [artifacts.md](./artifacts.md) — top-level structure of each artifact type
- [fields.md](./fields.md) — field types and identifier rules
- [parties.md](./parties.md) — party role configuration
- [logic.md](./logic.md) — defs, rules, CondExpr context
- [layers.md](./layers.md) — layer schema
- [annexes.md](./annexes.md) — annex schema
- [instructions.md](./instructions.md) — ContentRef
- [pdf-bindings.md](./pdf-bindings.md) — PDF AcroForm bindings
- [cli.md](./cli.md) — `para validate` and `para fix` flags
