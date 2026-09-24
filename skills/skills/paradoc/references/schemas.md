---
name: schemas
description: The raw JSON/YAML surface. File shape, the $schema version and loading rules, migration, identifier patterns, and the validator's real error messages with their fixes.
metadata:
  tags: schemas, json, yaml, $schema, schema-version, migrate, loading, identifiers, naming, validation, errors
---

# JSON and YAML artifacts

**Contents:** [File shape](#file-shape) · [Schema version](#schema-version) · [Identifier patterns](#identifier-patterns) · [Error messages](#error-messages)

Use this surface to write or edit artifact files by hand. For the keys of each kind, load [artifacts.md](./artifacts.md); for field shapes, [fields.md](./fields.md). Check every edit with [`paradoc validate`](./cli.md#validate); a form with a layer is finished when the [round trip](./cli.md#round-trip) passes.

## File shape

Every file starts with `$schema`, `kind` and `name`:

```json schema=artifact
{
  "$schema": "https://schema.paradoc.dev/2026-09-24.json",
  "kind": "form",
  "name": "pet-registration",
  "version": "1.0.0",
  "title": "Pet Registration",
  "fields": {
    "petName": { "type": "text", "label": "Pet name", "required": true },
    "species": { "type": "enum", "label": "Species", "enum": [{ "value": "dog" }, { "value": "cat" }] }
  }
}
```

The same file in YAML. `.yaml` and `.yml` both load. The comment line gives editors completion against the schema:

```yaml
# yaml-language-server: $schema=https://schema.paradoc.dev/2026-09-24.json
$schema: https://schema.paradoc.dev/2026-09-24.json
kind: form
name: pet-registration
version: 1.0.0
title: Pet Registration
fields:
  petName: { type: text, label: Pet name, required: true }
  species:
    type: enum
    label: Species
    enum: [{ value: dog }, { value: cat }]
```

Every object in the schema is strict, so an unknown key is an error. Name the file after `name` (`pet-registration.yaml`).

## Schema version

The current schema version is `2026-09-24`. Write `$schema` as its dated address, the same for every kind:

```text
https://schema.paradoc.dev/2026-09-24.json
```

A dated per-kind address such as `https://schema.paradoc.dev/2026-09-24/form.json` names the same version. The SDK writes the dated address on `toJSON()` and `toYAML()`. Each new dated version ships with a migration step.

### Loading rules

These surfaces refuse an artifact whose `$schema` is not current: `load()` and `loadFromObject()` in the SDK, every CLI command that reads an artifact file, `@paradoc/ai-tools`, and `paradoc add`.

<!-- dep:C2 -->
`p.form()` and each kind's `.from()` apply the same rules.

| `$schema` | Error code | Message starts with |
|-----------|------------|---------------------|
| Current dated address | none | loads |
| Earlier dated address | `outdated-version` | `The artifact was written for schema version <v>; ...` |
| Missing | `missing-version` | `The artifact has no $schema; ...` |
| Undated (`schema.json`) | `unknown-version` | `$schema ... names no schema version; ...` |
| Unpublished date, or not a Paradoc address | `unknown-version` | `$schema names schema version <v>, which does not exist` or `... is not a Paradoc schema address` |

The SDK throws `SchemaVersionError` with that `code`. Run [migrate](#migrate) to upgrade; loading does not. An object passed to `loadFromObject()`, `p.<kind>()`, `.from()`, `.safeFrom()` or a builder's `.from()`, or an inline `artifact` given to the AI tools, may leave out `$schema`; one it declares must be current, and so must one on each inline part of a bundle. SDK `validate()` reports an outdated or unknown `$schema` as an issue at `$schema`.

### Migrate

Upgrade `$schema` with `migrate`, which also converts the values the new version reads differently. A hand edit of `$schema` skips those steps.

```bash
paradoc migrate pet-registration.yaml --dry-run      # print the diff, then run without --dry-run
```

Flags, statuses and exit codes: [cli.md § migrate](./cli.md#migrate). In code: [sdk.md § Load and migrate](./sdk.md#load-and-migrate).

## Identifier patterns

| Identifier | Pattern | Max |
|------------|---------|-----|
| Artifact `name`, metadata keys | `^[A-Za-z0-9]([A-Za-z0-9]\|-[A-Za-z0-9])*$` | 128 (metadata keys 100) |
| Keys of `fields` (nested too), `layers`, `annexes`, `defs`, `rules` | `^[a-z][a-zA-Z0-9_]*$` | 100 |
| Party role keys | `^[a-z][a-zA-Z0-9_]*$` | 50 |
| Bundle content `key` | `^[a-zA-Z][a-zA-Z0-9_-]*$` | 100 |
| Checklist item `id` | any non-empty string, unique | 128 |
| `version` | SemVer 2.0.0, no leading `v` | 200 |
| `checksum` | `^sha256:[a-f0-9]{64}$` | none |

| Kind | Valid | Invalid |
|------|-------|---------|
| Artifact name | `pet-registration`, `W9`, `form-1040` | `-form`, `my--form`, `form-`, `my_form` |
| Field, def, rule | `firstName`, `monthly_rent`, `hasPets` | `FirstName`, `first-name`, `1stField` |
| Version | `1.0.0`, `1.0.0-rc.1+build.5` | `v1.0.0`, `1.0`, `01.0.0` |

Write kebab-case artifact names and camelCase keys inside an artifact.

## Error messages

The validator prints `<path>: <message>`. Match on the message:

| Message | Cause | Fix |
|---------|-------|-----|
| `root: Artifact must be an object with a "kind" property` | No `kind` | Add `kind`: `form`, `document`, `checklist` or `bundle` |
| `kind: Invalid artifact kind: <x>. Must be one of: ...` | Unknown kind | Use one of the four kinds |
| `name: Invalid input: expected string, received undefined` | No `name` | Add `name` |
| `name: Invalid string: must match pattern ...` | Bad artifact name | Use kebab-case ([patterns](#identifier-patterns)) |
| `version: Invalid string: must match pattern ...` | Not SemVer | Write `1.0.0` |
| `fields.<key>: Invalid key in record` | Bad key | Write camelCase, starting with a lowercase letter |
| `fields.<id>.type: Invalid discriminator value. Expected 'text' \| ...` | `type` missing or unknown | See [Unknown field type](#unknown-field-type) |
| `fields.<id>: Unrecognized key: "<key>"` | A key the type does not have | Remove it, or check the spelling in [fields.md](./fields.md) |
| `fields.<id>.enum: Invalid input: expected array, received undefined` | `enum` or `multiselect` without options | Add `"enum": [{ "value": "a" }]` |
| `parties.<role>.label: Invalid input: expected string, received undefined` | Party without `label` | Add `label` ([parties.md](./parties.md)) |
| `rules: Invalid input: expected record, received array` | `rules` written as an array | Key each rule by id: `"rules": { "<id>": { ... } }` |
| `contents: Invalid input: expected array, received undefined` | Bundle without `contents` | Add `contents` (may be `[]`) |
| `contents.<n>.type: Invalid discriminator value. Expected 'inline' \| 'path' \| 'registry'` | Bundle item without `type` | See [artifacts.md](./artifacts.md) |
| `items: Invalid input: expected array, received undefined` | Checklist without `items` | Add `items` (may be `[]`) |
| `items.<n>.title: Invalid input: expected string, received undefined` | Checklist item without `title` | Add `title` |
| `layers.<key>.checksum: Invalid string: must match pattern ...` | Hand-written checksum | Run `paradoc fix <file> -y` |
| `<path>: Unknown variable: "<ref>"` | An expression names something that does not exist | See [Expression references](#expression-references) |
| `<path>: Syntax error: Use 'and'; '&&' is not supported.` | JavaScript operators | Write `and`, `or`, `not` ([logic.md](./logic.md)) |
| `<path>: A gate must be boolean, got <type>` | A condition that returns another type | Make the gate a comparison |

### Unknown field type

The message lists every valid type. Common mix-ups:

| Wrong | Right |
|-------|-------|
| `"type": "string"` | `"type": "text"` |
| `"type": "integer"` | `"type": "number"` |
| `"type": "currency"` | `"type": "money"` |
| `"type": "select"` | `"type": "enum"` |
| `"type": "checkbox"` | `"type": "boolean"` |
| `"type": "array"` | `"type": "list"` |
| `"type": "object"` | `"type": "fieldset"` |

`number`, `datetime` and `list` are valid types. When the message names one of them, look for the bad `type` on another field. The full list is in [fields.md § Field Type Reference](./fields.md#field-type-reference).

### Expression references

- `visible`, `required` and other field-level expressions name fields as `fields.<id>`. A bare `<id>` fails with `Unknown variable: "<id>"`.
- A `rules` expression accepts both `<id>` and `fields.<id>`.
- For the names each other site can read, load [logic.md § Where expressions go](./logic.md#where-expressions-go).
