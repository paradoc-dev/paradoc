# AGENTS.md

Guidance for AI agents working in this repository.

## Repository Overview

The official agent skill for [Paradoc](https://paradoc.dev) — the documents-as-code framework.

A single skill at `skills/paradoc/` with topic-organized references. Covers every Paradoc surface (TypeScript SDK, `para` CLI, raw JSON/YAML schemas, `mcp.paradoc.dev` MCP service) and end-to-end workflows (creating new forms, converting PDFs).

## Repository Structure

```
.
├── AGENTS.md         # This file (CLAUDE.md is a symlink to it)
├── CLAUDE.md         # → AGENTS.md
├── README.md         # User-facing overview
└── skills/
    └── paradoc/
        ├── SKILL.md
        ├── metadata.json
        └── references/
            # Surface refs — how to express things on each surface
            ├── sdk.md, cli.md, schemas.md, mcp.md
            # Topic refs — canonical concept knowledge (surface-agnostic)
            ├── artifacts.md, fields.md, parties.md, annexes.md,
            ├── logic.md, layers.md, rendering.md, serialization.md,
            ├── instructions.md, pdf-bindings.md
            # Workflow refs — staged interactive pipelines
            └── workflow-create-form.md, workflow-convert-pdf.md
```

## Three Reference Categories

When adding or editing references, place them in the right category:

| Category | Purpose | Examples |
|---|---|---|
| **Surface** | How to express things on a specific surface (SDK / CLI / JSON / MCP). Thin "express it this way" guides that link to topic refs for shape details. | `sdk.md`, `cli.md`, `schemas.md`, `mcp.md` |
| **Topic** | Canonical concept knowledge, surface-agnostic. The single source of truth per concept. Show JSON and SDK side-by-side where appropriate. | `fields.md`, `parties.md`, `logic.md` |
| **Workflow** | Staged interactive pipelines that orchestrate other refs. Each stage links to topic refs rather than duplicating content. | `workflow-create-form.md`, `workflow-convert-pdf.md` |

**Principle:** topic refs are canonical. Surface refs and workflow refs link to topic refs — they NEVER re-document concepts that belong in a topic ref.

## Skill File Conventions

Skills follow the [Agent Skills specification](https://agentskills.io/specification.md). Read it before making structural changes.

### `SKILL.md` frontmatter

Spec-compliant fields used in this repo:

| Field | Required | Notes |
|---|---|---|
| `name` | YES | Must equal parent dir (`paradoc`). Lowercase + hyphens only, 1-64 chars. |
| `description` | YES | Max 1024 chars. Describe what + when to use, with trigger phrases. |
| `metadata` | No | Author, version (semver), tags. |
| `allowed-tools` | No | Space-separated pre-approved tools (experimental Claude Code field). |

Keep `SKILL.md` under 500 lines. It loads in full on activation. Move detail to references.

### Reference frontmatter

Each `references/*.md` file uses:

```yaml
---
name: <ref-name>
description: <one-line description>
metadata:
  tags: <comma-separated>
---
```

References are loaded on demand (progressive disclosure), so size is less constrained than `SKILL.md` — but keep them focused on a single topic.

### Naming

- Skill directory: `paradoc/` (single skill, no prefix)
- `SKILL.md`: always uppercase, exact filename
- Surface refs: single word — `sdk.md`, `cli.md`, `schemas.md`, `mcp.md`
- Topic refs: single concept — `fields.md`, `parties.md`. Hyphens permitted for genuine compound concepts: `pdf-bindings.md`
- Workflow refs: prefixed with `workflow-` — `workflow-create-form.md`, `workflow-convert-pdf.md`

The `workflow-` prefix is load-bearing — it groups workflows alphabetically at the bottom of listings and makes their kind obvious without a subdirectory. Do not nest in `references/workflows/`.

### Cross-references

Use relative links from the file's own location: `[fields](./fields.md)` from a sibling reference, `[references/fields.md](./references/fields.md)` from `SKILL.md`.

Keep references **one level deep** from `SKILL.md` (per the spec). NEVER nest sub-folders inside `references/`.

## Writing Style

- **Imperative / infinitive form.** "Use the most specific type." NOT "You should use..."
- **Prescriptive language for rules:** ALWAYS, NEVER, MUST, SHOULD, FORBIDDEN, DO NOT.
- **Tables for reference data** — type matrices, decision matrices, command flags.
- **Code blocks with language tags** — `json`, `typescript`, `bash`, `handlebars`.
- **Bold key terms** sparingly. No emoji unless the user requests them.
- **One concept per section.** Short paragraphs.
- Cite real Paradoc APIs only — NEVER fabricate method names, package names, or schema URIs.
- Show wrong + right examples for common pitfalls.
- For files >100 lines, include a `**Contents:**` table-of-contents line at the top.

## Global Rules in the Skill

The skill itself enforces these — repeat them in any reference where they're directly relevant, and ALWAYS surface them to the user when applicable:

- Schema version `2026-01-01`. `$schema` URIs: `https://schema.paradoc.dev/2026-01-01/<form|document|bundle|checklist>.json`
- Validate with `npx paradoc validate <file>` (NOT `para validate`) when working with files directly
- Artifact name pattern: `^[A-Za-z0-9]([A-Za-z0-9]|-[A-Za-z0-9])*$` (kebab-case, no leading/trailing/consecutive hyphens)
- Field/party/def/rule pattern: `^[a-z][a-zA-Z0-9_]*$` (camelCase preferred)
- Field types: ALWAYS prefer the most specific type. NEVER `text` when a structured type fits
- Handlebars: field values are spread at top level — use `{{fieldName}}`, NOT `{{fields.fieldName}}`
- Signatures: ALWAYS use `{{signature "loc"}}` / `{{initials "loc"}}` / `{{signatureDate "loc"}}` helpers inside party blocks. NEVER manual underscore lines.

## Validation

Validate the skill structure with the Agent Skills reference library:

```bash
skills-ref validate ./skills/paradoc
```

## When Editing

1. Identify the right category (surface / topic / workflow). Resist re-documenting concepts in surface or workflow refs — link to the topic ref instead.
2. If a topic ref grows past ~500 lines, consider splitting along sub-topic lines, but keep the new files in the flat `references/` directory.
3. Update cross-references when renaming or moving files. Search the repo for the old name.
4. Bump `metadata.version` (semver) in `SKILL.md` and `metadata.json` when shipping changes.
